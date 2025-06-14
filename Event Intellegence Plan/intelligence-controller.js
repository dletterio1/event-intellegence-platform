/**
 * Intelligence API Controller
 * Exposes the intelligence engine through clean, intuitive endpoints
 */

const EventIntelligenceService = require('../services/intelligence/event-intelligence.service');
const { ResponseFormatter } = require('../utils/responseFormatter');
const { UserFriendlyError } = require('../utils/errors');
const logger = require('../utils/logger');
const csvParser = require('../utils/csvParser');
const redis = require('../config/redis');

class IntelligenceController {
  constructor() {
    this.intelligenceService = new EventIntelligenceService();
  }
  
  /**
   * Upload and analyze customer data
   * @route POST /api/v1/adbuilder/intelligence/analyze
   */
  async analyzeCustomerData(req, res) {
    try {
      const { organizationId, userId } = req.auth;
      const { file } = req; // Multer processed file
      const { 
        eventId,
        campaignGoal = 'conversion',
        budget,
        platforms = ['meta'],
        quickAnalysis = false
      } = req.body;
      
      // Validate file
      if (!file) {
        throw new UserFriendlyError(
          'Please upload a CSV file with customer data',
          'NO_FILE_UPLOADED'
        );
      }
      
      // Start analysis job
      const analysisId = await this.startAnalysisJob({
        organizationId,
        userId,
        filePath: file.path,
        eventId,
        campaignGoal,
        budget,
        platforms,
        quickAnalysis
      });
      
      // For quick analysis, wait for results
      if (quickAnalysis) {
        const results = await this.waitForAnalysis(analysisId, 30000); // 30 second timeout
        return ResponseFormatter.success(res, results, 'Analysis complete');
      }
      
      // For full analysis, return job ID
      return ResponseFormatter.success(res, {
        analysisId,
        status: 'processing',
        estimatedTime: '2-5 minutes',
        statusUrl: `/api/v1/adbuilder/intelligence/status/${analysisId}`
      }, 'Analysis started. Check status for results.');
      
    } catch (error) {
      logger.error('Customer analysis failed', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Get analysis status/results
   * @route GET /api/v1/adbuilder/intelligence/status/:analysisId
   */
  async getAnalysisStatus(req, res) {
    try {
      const { organizationId } = req.auth;
      const { analysisId } = req.params;
      
      // Get status from Redis
      const status = await redis.get(`analysis:${analysisId}`);
      
      if (!status) {
        throw new UserFriendlyError(
          'Analysis not found or expired',
          'ANALYSIS_NOT_FOUND'
        );
      }
      
      const analysisData = JSON.parse(status);
      
      // Verify organization match
      if (analysisData.organizationId !== organizationId) {
        throw new UserFriendlyError(
          'Unauthorized access to analysis',
          'UNAUTHORIZED'
        );
      }
      
      return ResponseFormatter.success(res, analysisData);
      
    } catch (error) {
      logger.error('Failed to get analysis status', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Get quick insights without uploading data
   * @route GET /api/v1/adbuilder/intelligence/insights
   */
  async getQuickInsights(req, res) {
    try {
      const { organizationId } = req.auth;
      const { 
        eventType = 'general',
        eventDate,
        expectedAttendance,
        campaignGoal = 'conversion',
        budget
      } = req.query;
      
      // Generate insights based on existing data or benchmarks
      const insights = await this.intelligenceService.analyzeAndRecommend(
        organizationId,
        {
          eventId: null,
          campaignGoal,
          budget: budget ? parseFloat(budget) : null,
          sophisticationLevel: 'simple'
        }
      );
      
      // Add event context if provided
      if (eventType && eventDate) {
        insights.recommendations = this.enhanceWithEventContext(
          insights.recommendations,
          { eventType, eventDate, expectedAttendance }
        );
      }
      
      return ResponseFormatter.success(res, {
        insights: insights.recommendations,
        confidence: insights.metadata.confidence,
        basedOn: insights.metadata.dataPoints > 0 
          ? `${insights.metadata.dataPoints} customers` 
          : 'Industry benchmarks'
      }, 'Insights generated successfully');
      
    } catch (error) {
      logger.error('Failed to generate quick insights', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Create smart segments from existing data
   * @route POST /api/v1/adbuilder/intelligence/segments/create
   */
  async createSmartSegments(req, res) {
    try {
      const { organizationId, userId } = req.auth;
      const { 
        campaignGoal = 'conversion',
        maxSegments = 5,
        minSegmentSize = 100,
        includeEmptySegments = false
      } = req.body;
      
      // Generate segments
      const analysis = await this.intelligenceService.analyzeAndRecommend(
        organizationId,
        { campaignGoal, sophisticationLevel: 'advanced' }
      );
      
      if (!analysis.intelligence?.segments?.length) {
        throw new UserFriendlyError(
          'Not enough data to create segments. Please upload customer data first.',
          'INSUFFICIENT_DATA'
        );
      }
      
      // Filter and format segments
      const segments = analysis.intelligence.segments
        .filter(seg => includeEmptySegments || seg.size >= minSegmentSize)
        .slice(0, maxSegments)
        .map(seg => ({
          id: seg.id,
          name: seg.name,
          description: seg.intelligence.description,
          size: seg.size,
          estimatedValue: seg.value,
          recommendations: {
            messaging: seg.intelligence.messaging,
            timing: seg.intelligence.optimalWindow,
            expectedROI: seg.intelligence.expectedROI
          },
          actions: [
            {
              label: 'Create Meta Audience',
              action: 'create_meta_audience',
              enabled: seg.size >= 1000
            },
            {
              label: 'Export Emails',
              action: 'export_emails',
              enabled: true
            }
          ]
        }));
      
      return ResponseFormatter.success(res, {
        segments,
        totalCustomers: analysis.metadata.dataPoints,
        segmentationQuality: analysis.metadata.confidence
      }, `${segments.length} segments created successfully`);
      
    } catch (error) {
      logger.error('Failed to create segments', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Get campaign timing recommendations
   * @route GET /api/v1/adbuilder/intelligence/timing
   */
  async getTimingRecommendations(req, res) {
    try {
      const { organizationId } = req.auth;
      const { eventId, eventDate, eventType = 'general' } = req.query;
      
      if (!eventId && !eventDate) {
        throw new UserFriendlyError(
          'Please provide either eventId or eventDate',
          'MISSING_EVENT_INFO'
        );
      }
      
      // Get timing intelligence
      const analysis = await this.intelligenceService.analyzeAndRecommend(
        organizationId,
        { 
          eventId,
          campaignGoal: 'conversion',
          sophisticationLevel: 'simple'
        }
      );
      
      const timing = analysis.recommendations.calendar || 
        this.generateDefaultTiming(eventDate || new Date(), eventType);
      
      // Format as actionable calendar
      const calendar = {
        campaignStart: timing[0]?.date,
        campaignEnd: timing[timing.length - 1]?.date,
        phases: timing.map(phase => ({
          name: phase.name,
          startDate: phase.date,
          duration: phase.duration,
          budgetPercentage: phase.budgetPercentage,
          focus: phase.focus,
          keyMessages: phase.messages,
          expectedResults: phase.expectedResults
        })),
        criticalDates: this.extractCriticalDates(timing),
        budgetPacing: this.generateBudgetPacing(timing)
      };
      
      return ResponseFormatter.success(res, {
        calendar,
        reasoning: analysis.intelligence?.timing?.reasoning || 
          'Based on typical purchase patterns for ' + eventType,
        confidence: analysis.metadata.confidence
      }, 'Timing recommendations generated');
      
    } catch (error) {
      logger.error('Failed to generate timing recommendations', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Get platform-specific targeting recommendations
   * @route GET /api/v1/adbuilder/intelligence/targeting/:platform
   */
  async getTargetingRecommendations(req, res) {
    try {
      const { organizationId } = req.auth;
      const { platform } = req.params;
      const { 
        segmentId,
        campaignGoal = 'conversion',
        hasCustomerList = false
      } = req.query;
      
      // Validate platform
      if (!['meta', 'google', 'tiktok'].includes(platform)) {
        throw new UserFriendlyError(
          'Invalid platform. Choose: meta, google, or tiktok',
          'INVALID_PLATFORM'
        );
      }
      
      // Get intelligence
      const analysis = await this.intelligenceService.analyzeAndRecommend(
        organizationId,
        { 
          campaignGoal,
          platforms: [platform],
          sophisticationLevel: hasCustomerList ? 'advanced' : 'simple'
        }
      );
      
      const platformConfig = analysis.recommendations.campaign[platform];
      
      if (!platformConfig) {
        throw new UserFriendlyError(
          'No recommendations available for ' + platform,
          'NO_RECOMMENDATIONS'
        );
      }
      
      // Format for easy consumption
      const targeting = {
        platform,
        strategy: hasCustomerList ? 'custom_audience' : 'interest_based',
        audiences: this.formatAudiencesForPlatform(platformConfig.audiences, platform),
        creativeGuidance: platformConfig.creative,
        budgetGuidance: {
          recommended: this.calculateRecommendedBudget(platform, campaignGoal),
          distribution: platformConfig.budget
        },
        implementation: this.getImplementationSteps(platform, hasCustomerList)
      };
      
      return ResponseFormatter.success(res, targeting, 
        `${platform} targeting recommendations ready`);
      
    } catch (error) {
      logger.error('Failed to generate targeting recommendations', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  /**
   * Generate campaign brief with all intelligence
   * @route POST /api/v1/adbuilder/intelligence/brief
   */
  async generateCampaignBrief(req, res) {
    try {
      const { organizationId, userId } = req.auth;
      const {
        eventId,
        eventName,
        eventDate,
        campaignGoal = 'conversion',
        budget,
        platforms = ['meta'],
        targetSegments = []
      } = req.body;
      
      // Run full analysis
      const analysis = await this.intelligenceService.analyzeAndRecommend(
        organizationId,
        {
          eventId,
          campaignGoal,
          budget,
          platforms,
          sophisticationLevel: 'advanced'
        }
      );
      
      // Generate comprehensive brief
      const brief = {
        executive_summary: this.generateExecutiveSummary(analysis, req.body),
        campaign_strategy: {
          goal: campaignGoal,
          kpis: this.getKPIsForGoal(campaignGoal),
          success_metrics: this.getSuccessMetrics(campaignGoal, budget)
        },
        audience_strategy: {
          primary_segments: analysis.intelligence.segments?.slice(0, 3) || [],
          total_addressable_audience: this.calculateTAM(analysis),
          exclusions: analysis.recommendations.immediate
            .filter(a => a.action.includes('exclusion'))
        },
        channel_strategy: {
          recommended_mix: analysis.intelligence.channelStrategy,
          platform_priorities: this.prioritizePlatforms(platforms, analysis),
          budget_allocation: this.allocateBudget(budget, platforms, analysis)
        },
        creative_direction: {
          key_messages: this.generateKeyMessages(analysis, campaignGoal),
          creative_themes: this.getCreativeThemes(analysis),
          cta_recommendations: this.getCTARecommendations(campaignGoal)
        },
        timeline: {
          launch_date: analysis.recommendations.calendar[0]?.date,
          key_milestones: analysis.recommendations.calendar,
          optimization_checkpoints: this.getOptimizationSchedule(analysis)
        },
        expected_results: {
          conversions: this.estimateConversions(analysis, budget),
          roi: this.estimateROI(analysis, budget),
          confidence_level: analysis.metadata.confidence
        },
        next_steps: this.generateNextSteps(analysis)
      };
      
      return ResponseFormatter.success(res, {
        brief,
        downloadUrl: `/api/v1/adbuilder/intelligence/brief/${analysisId}/download`,
        shareableLink: `/share/brief/${analysisId}`
      }, 'Campaign brief generated successfully');
      
    } catch (error) {
      logger.error('Failed to generate campaign brief', error);
      return ResponseFormatter.error(res, error);
    }
  }
  
  // Helper Methods
  
  async startAnalysisJob(jobData) {
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store initial status
    await redis.setex(
      `analysis:${analysisId}`,
      3600, // 1 hour TTL
      JSON.stringify({
        id: analysisId,
        status: 'processing',
        progress: 0,
        ...jobData,
        startedAt: new Date()
      })
    );
    
    // Start async processing
    this.processAnalysis(analysisId, jobData);
    
    return analysisId;
  }
  
  async processAnalysis(analysisId, jobData) {
    try {
      // Update progress
      await this.updateAnalysisProgress(analysisId, 10, 'Parsing CSV file...');
      
      // Parse CSV
      const csvData = await csvParser.parse(jobData.filePath);
      await this.updateAnalysisProgress(analysisId, 30, 'Analyzing customer patterns...');
      
      // Run intelligence analysis
      const results = await this.intelligenceService.analyzeAndRecommend(
        jobData.organizationId,
        {
          csvData,
          ...jobData
        }
      );
      
      await this.updateAnalysisProgress(analysisId, 90, 'Generating recommendations...');
      
      // Store results
      await redis.setex(
        `analysis:${analysisId}`,
        86400, // 24 hour TTL for results
        JSON.stringify({
          id: analysisId,
          status: 'complete',
          progress: 100,
          results,
          completedAt: new Date()
        })
      );
      
    } catch (error) {
      logger.error(`Analysis ${analysisId} failed`, error);
      
      await redis.setex(
        `analysis:${analysisId}`,
        3600,
        JSON.stringify({
          id: analysisId,
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        })
      );
    }
  }
  
  async updateAnalysisProgress(analysisId, progress, message) {
    const current = await redis.get(`analysis:${analysisId}`);
    if (current) {
      const data = JSON.parse(current);
      data.progress = progress;
      data.currentStep = message;
      data.updatedAt = new Date();
      await redis.setex(`analysis:${analysisId}`, 3600, JSON.stringify(data));
    }
  }
  
  formatAudiencesForPlatform(audiences, platform) {
    return audiences.map(aud => {
      const formatted = {
        name: aud.name,
        type: aud.type,
        estimatedSize: aud.size
      };
      
      switch (platform) {
        case 'meta':
          formatted.implementation = aud.type === 'custom' 
            ? 'Upload customer list → Create lookalike'
            : `Target interests: ${aud.targeting?.interests?.join(', ')}`;
          break;
          
        case 'google':
          formatted.implementation = aud.type === 'custom'
            ? 'Customer Match → Similar Audiences'
            : `Keywords: ${aud.keywords?.join(', ')}`;
          break;
          
        case 'tiktok':
          formatted.implementation = aud.type === 'custom'
            ? 'Custom Audience → Lookalike'
            : `Interest categories: ${aud.categories?.join(', ')}`;
          break;
      }
      
      return formatted;
    });
  }
  
  generateExecutiveSummary(analysis, requestData) {
    const confidence = analysis.metadata.confidence;
    const dataPoints = analysis.metadata.dataPoints;
    
    return `Based on analysis of ${dataPoints > 0 ? dataPoints + ' customers' : 'industry benchmarks'}, 
    we recommend targeting ${analysis.intelligence.segments?.[0]?.name || 'broad audience'} 
    starting ${analysis.recommendations.calendar?.[0]?.date || '45 days before event'}. 
    Expected ROI: ${analysis.intelligence.segments?.[0]?.intelligence?.expectedROI || '3-4'}x 
    with ${confidence} confidence.`;
  }
}

module.exports = new IntelligenceController();