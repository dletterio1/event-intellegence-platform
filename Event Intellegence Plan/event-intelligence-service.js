/**
 * Event Intelligence Service
 * The brain that transforms data into actionable marketing intelligence
 * 
 * Works for:
 * - Cold start (no data) → Industry benchmarks
 * - Small brand (100 customers) → Basic patterns
 * - Enterprise (100K customers) → Full attribution
 */

const { 
  CustomerIntelligence, 
  EventPattern, 
  CampaignIntelligence,
  SegmentDefinition 
} = require('../models/intelligence.models');
const EventIntelligencePipeline = require('./intelligence.pipeline');
const logger = require('../utils/logger');

class EventIntelligenceService {
  constructor() {
    this.pipeline = new EventIntelligencePipeline();
  }
  
  /**
   * Main entry point - analyzes data and returns intelligence
   * Adapts complexity to available data
   */
  async analyzeAndRecommend(organizationId, options = {}) {
    const {
      csvData = null,
      eventId = null,
      campaignGoal = 'conversion', // 'awareness', 'conversion', 'retention'
      budget = null,
      platforms = ['meta'],
      sophisticationLevel = 'auto' // 'simple', 'advanced', 'auto'
    } = options;
    
    try {
      // Step 1: Gather available data
      const dataContext = await this.gatherDataContext(organizationId, csvData, eventId);
      
      // Step 2: Determine sophistication level
      const level = this.determineSophisticationLevel(dataContext, sophisticationLevel);
      
      // Step 3: Generate intelligence based on data availability
      const intelligence = await this.generateIntelligence(dataContext, {
        campaignGoal,
        budget,
        platforms,
        level
      });
      
      // Step 4: Transform to actionable recommendations
      const recommendations = await this.transformToRecommendations(intelligence, platforms);
      
      return {
        success: true,
        intelligence,
        recommendations,
        metadata: {
          confidence: dataContext.confidence,
          dataPoints: dataContext.totalCustomers,
          sophisticationLevel: level,
          generatedAt: new Date()
        }
      };
      
    } catch (error) {
      logger.error('Intelligence analysis failed', error);
      throw error;
    }
  }
  
  /**
   * Gather all available data context
   */
  async gatherDataContext(organizationId, csvData, eventId) {
    const context = {
      organizationId,
      hasNewData: !!csvData,
      totalCustomers: 0,
      hasHistoricalData: false,
      eventType: null,
      confidence: 'low'
    };
    
    // Check existing customer intelligence
    const existingCustomers = await CustomerIntelligence.countDocuments({ 
      _organization: organizationId 
    });
    
    context.hasHistoricalData = existingCustomers > 0;
    context.totalCustomers = existingCustomers;
    
    // If CSV provided, process it
    if (csvData) {
      context.newCustomers = await this.pipeline.ingestCustomerData(csvData, organizationId);
      context.totalCustomers += context.newCustomers.length;
    }
    
    // Get event context if provided
    if (eventId) {
      context.event = await this.getEventContext(eventId);
      context.eventType = context.event?.type;
      
      // Check for event patterns
      context.eventPattern = await EventPattern.findOne({ 
        _organization: organizationId,
        _event: eventId 
      });
    }
    
    // Determine confidence level
    if (context.totalCustomers > 1000) {
      context.confidence = 'high';
    } else if (context.totalCustomers > 100) {
      context.confidence = 'medium';
    }
    
    return context;
  }
  
  /**
   * Generate intelligence based on available data
   */
  async generateIntelligence(dataContext, options) {
    const { campaignGoal, budget, level } = options;
    
    // Cold start - use benchmarks
    if (dataContext.confidence === 'low' && !dataContext.hasHistoricalData) {
      return this.generateColdStartIntelligence(dataContext, campaignGoal);
    }
    
    // Has data - analyze patterns
    const patterns = await this.analyzePatterns(dataContext);
    
    // Generate segments
    const segments = await this.generateSegments(dataContext, patterns, campaignGoal);
    
    // Generate timing intelligence
    const timing = await this.generateTimingIntelligence(dataContext, patterns, campaignGoal);
    
    // Generate channel strategy
    const channelStrategy = await this.generateChannelStrategy(dataContext, budget, campaignGoal);
    
    return {
      segments,
      timing,
      channelStrategy,
      patterns,
      confidence: dataContext.confidence
    };
  }
  
  /**
   * Cold Start Intelligence - When you have no data
   */
  async generateColdStartIntelligence(dataContext, campaignGoal) {
    const eventType = dataContext.eventType || 'general';
    
    // Use industry benchmarks
    const benchmarks = this.getIndustryBenchmarks(eventType);
    
    return {
      segments: [
        {
          name: 'Early Interest',
          description: `People who typically buy ${eventType} tickets early`,
          size: 'TBD - Build lookalike from your early registrants',
          intelligence: {
            targeting: this.getDefaultTargeting(eventType, 'early'),
            timing: benchmarks.earlyBird,
            messaging: 'Early bird pricing now available'
          }
        },
        {
          name: 'Main Wave',
          description: 'The majority of your audience',
          size: 'TBD - Broad targeting based on event type',
          intelligence: {
            targeting: this.getDefaultTargeting(eventType, 'general'),
            timing: benchmarks.mainWave,
            messaging: `Don't miss ${eventType}`
          }
        },
        {
          name: 'Last Minute',
          description: 'Impulse buyers and procrastinators',
          size: 'TBD - Retargeting + urgency',
          intelligence: {
            targeting: this.getDefaultTargeting(eventType, 'urgent'),
            timing: benchmarks.lastMinute,
            messaging: 'Final tickets available'
          }
        }
      ],
      timing: {
        recommendedStart: benchmarks.campaignStart,
        phases: benchmarks.phases,
        budgetAllocation: benchmarks.budgetCurve
      },
      channelStrategy: {
        primary: 'meta',
        reasoning: 'Best for cold audiences without customer data',
        tactics: benchmarks.tactics[campaignGoal]
      },
      confidence: 'low',
      note: 'Recommendations based on industry patterns. Will improve as we collect your data.'
    };
  }
  
  /**
   * Analyze patterns in customer data
   */
  async analyzePatterns(dataContext) {
    const patterns = {
      purchase: {},
      behavioral: {},
      value: {}
    };
    
    // Analyze purchase timing patterns
    patterns.purchase = await this.analyzePurchasePatterns(dataContext);
    
    // Analyze behavioral segments
    patterns.behavioral = await this.analyzeBehavioralPatterns(dataContext);
    
    // Analyze value distribution
    patterns.value = await this.analyzeValuePatterns(dataContext);
    
    // If we have campaign history, analyze what worked
    if (dataContext.hasHistoricalData) {
      patterns.campaign = await this.analyzeCampaignPatterns(dataContext);
    }
    
    return patterns;
  }
  
  /**
   * Generate smart segments based on patterns and goal
   */
  async generateSegments(dataContext, patterns, campaignGoal) {
    const segments = [];
    
    // Goal-specific segment generation
    switch (campaignGoal) {
      case 'conversion':
        segments.push(...this.generateConversionSegments(patterns));
        break;
      case 'awareness':
        segments.push(...this.generateAwarenessSegments(patterns));
        break;
      case 'retention':
        segments.push(...this.generateRetentionSegments(patterns));
        break;
    }
    
    // Add universal high-value segments
    if (patterns.value.topDecile.length > 10) {
      segments.push({
        id: 'high_value_customers',
        name: 'VIP Customers',
        size: patterns.value.topDecile.length,
        value: patterns.value.topDecileValue,
        intelligence: {
          description: 'Your top 10% customers by lifetime value',
          targeting: { custom_audience: true, lookalike: true },
          messaging: 'Exclusive VIP experience',
          expectedROI: 4.5
        }
      });
    }
    
    // Score and rank segments
    const scoredSegments = segments.map(segment => ({
      ...segment,
      score: this.scoreSegment(segment, campaignGoal, dataContext)
    }));
    
    // Return top segments
    return scoredSegments
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  
  /**
   * Generate conversion-optimized segments
   */
  generateConversionSegments(patterns) {
    const segments = [];
    
    // Early converters
    if (patterns.purchase.earlyBirds?.length > 20) {
      segments.push({
        id: 'early_converters',
        name: 'Early Bird Buyers',
        size: patterns.purchase.earlyBirds.length,
        members: patterns.purchase.earlyBirds,
        intelligence: {
          description: `Buy ${patterns.purchase.avgEarlyDays} days in advance`,
          optimalWindow: { start: -60, peak: -45, end: -30 },
          messaging: 'Early bird pricing ends soon',
          conversionRate: patterns.purchase.earlyConversionRate || 0.15
        }
      });
    }
    
    // High-intent recent visitors
    if (patterns.behavioral.recentVisitors?.length > 50) {
      segments.push({
        id: 'high_intent_recent',
        name: 'High Intent Visitors',
        size: patterns.behavioral.recentVisitors.length,
        members: patterns.behavioral.recentVisitors,
        intelligence: {
          description: 'Visited 3+ times in last 30 days without purchasing',
          optimalWindow: { start: -30, peak: -14, end: -7 },
          messaging: 'Complete your purchase - special offer inside',
          conversionRate: 0.25
        }
      });
    }
    
    // Similar to past converters
    if (patterns.value.previousEventBuyers?.length > 100) {
      segments.push({
        id: 'repeat_likely',
        name: 'Likely Repeat Buyers',
        size: patterns.value.previousEventBuyers.length,
        members: patterns.value.previousEventBuyers,
        intelligence: {
          description: 'Bought similar events before',
          optimalWindow: { start: -45, peak: -30, end: -14 },
          messaging: 'You loved [previous event], you\'ll love this',
          conversionRate: 0.35
        }
      });
    }
    
    return segments;
  }
  
  /**
   * Transform intelligence into platform-specific recommendations
   */
  async transformToRecommendations(intelligence, platforms) {
    const recommendations = {
      immediate: [], // What to do right now
      campaign: {},  // Platform-specific configs
      calendar: []   // Time-based actions
    };
    
    // Generate immediate actions
    recommendations.immediate = this.generateImmediateActions(intelligence);
    
    // Generate platform-specific configurations
    for (const platform of platforms) {
      recommendations.campaign[platform] = await this.generatePlatformConfig(
        platform,
        intelligence
      );
    }
    
    // Generate marketing calendar
    recommendations.calendar = this.generateMarketingCalendar(intelligence);
    
    // Add budget recommendations if applicable
    if (intelligence.channelStrategy?.budgetAllocation) {
      recommendations.budget = intelligence.channelStrategy.budgetAllocation;
    }
    
    return recommendations;
  }
  
  /**
   * Generate immediate actionable recommendations
   */
  generateImmediateActions(intelligence) {
    const actions = [];
    
    // Top segment to target
    if (intelligence.segments?.[0]) {
      const topSegment = intelligence.segments[0];
      actions.push({
        priority: 'high',
        action: `Create ${topSegment.name} audience`,
        reasoning: `${topSegment.size} high-value prospects`,
        expectedImpact: `${topSegment.intelligence.expectedROI || 3}x ROI`,
        effort: 'low',
        link: `/adbuilder/audiences/create?segment=${topSegment.id}`
      });
    }
    
    // Timing recommendation
    if (intelligence.timing?.recommendedStart) {
      const daysUntilStart = Math.ceil(
        (new Date(intelligence.timing.recommendedStart) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilStart <= 7) {
        actions.push({
          priority: 'urgent',
          action: 'Launch campaign this week',
          reasoning: 'Optimal window starts in ${daysUntilStart} days',
          expectedImpact: 'Capture early bird segment',
          effort: 'medium'
        });
      }
    }
    
    // Exclusion opportunities
    if (intelligence.patterns?.waste?.length > 0) {
      actions.push({
        priority: 'medium',
        action: 'Create exclusion list',
        reasoning: `${intelligence.patterns.waste.length} people who never convert`,
        expectedImpact: 'Save 15-20% of budget',
        effort: 'low',
        link: '/adbuilder/audiences/exclusions'
      });
    }
    
    return actions;
  }
  
  /**
   * Generate platform-specific configuration
   */
  async generatePlatformConfig(platform, intelligence) {
    const config = {
      platform,
      audiences: [],
      targeting: {},
      creative: {},
      budget: {},
      schedule: {}
    };
    
    switch (platform) {
      case 'meta':
        return this.generateMetaConfig(intelligence);
      
      case 'google':
        return this.generateGoogleConfig(intelligence);
      
      case 'email':
        return this.generateEmailConfig(intelligence);
      
      default:
        return config;
    }
  }
  
  /**
   * Generate Meta-specific configuration
   */
  generateMetaConfig(intelligence) {
    const config = {
      platform: 'meta',
      audiences: [],
      creative: {
        formats: ['single_image', 'carousel'],
        themes: []
      }
    };
    
    // Convert segments to Meta audiences
    intelligence.segments.forEach(segment => {
      const audience = {
        name: segment.name,
        type: segment.members?.length > 1000 ? 'custom' : 'interest',
      };
      
      if (audience.type === 'custom') {
        // Use customer list
        audience.source = 'customer_list';
        audience.size = segment.size;
        audience.lookalike = {
          enabled: true,
          ratios: [0.01, 0.03] // 1% and 3%
        };
      } else {
        // Use interest targeting
        audience.targeting = this.inferInterestTargeting(segment, intelligence);
      }
      
      config.audiences.push(audience);
    });
    
    // Add timing configuration
    if (intelligence.timing) {
      config.schedule = {
        start_date: intelligence.timing.recommendedStart,
        end_date: intelligence.timing.recommendedEnd,
        dayparting: intelligence.timing.optimalHours || null,
        budget_schedule: intelligence.timing.budgetAllocation
      };
    }
    
    // Add creative recommendations
    config.creative.themes = this.getCreativeThemes(intelligence);
    
    return config;
  }
  
  /**
   * Industry benchmarks for cold start
   */
  getIndustryBenchmarks(eventType) {
    const benchmarks = {
      music_festival: {
        campaignStart: -60,
        earlyBird: { start: -60, end: -45 },
        mainWave: { start: -45, end: -14 },
        lastMinute: { start: -14, end: -1 },
        phases: [
          { name: 'Announcement', days: -60, focus: 'awareness' },
          { name: 'Early Bird', days: -45, focus: 'conversion' },
          { name: 'Main Push', days: -30, focus: 'conversion' },
          { name: 'Final Push', days: -7, focus: 'urgency' }
        ],
        budgetCurve: {
          '-60_to_-45': 0.20,
          '-45_to_-30': 0.30,
          '-30_to_-14': 0.30,
          '-14_to_-1': 0.20
        },
        tactics: {
          awareness: ['Video ads', 'Artist announcements', 'Festival experience content'],
          conversion: ['Early bird pricing', 'Limited tickets', 'Social proof']
        }
      },
      conference: {
        campaignStart: -90,
        earlyBird: { start: -90, end: -60 },
        mainWave: { start: -60, end: -30 },
        lastMinute: { start: -30, end: -7 },
        phases: [
          { name: 'Save the Date', days: -90, focus: 'awareness' },
          { name: 'Speaker Reveals', days: -60, focus: 'interest' },
          { name: 'Registration Push', days: -45, focus: 'conversion' },
          { name: 'Last Chance', days: -14, focus: 'urgency' }
        ],
        budgetCurve: {
          '-90_to_-60': 0.15,
          '-60_to_-45': 0.25,
          '-45_to_-30': 0.35,
          '-30_to_-7': 0.25
        },
        tactics: {
          awareness: ['Speaker highlights', 'Previous year success', 'Industry targeting'],
          conversion: ['Group discounts', 'VIP packages', 'Limited workshops']
        }
      },
      general: {
        campaignStart: -45,
        earlyBird: { start: -45, end: -30 },
        mainWave: { start: -30, end: -14 },
        lastMinute: { start: -14, end: -1 },
        phases: [
          { name: 'Launch', days: -45, focus: 'awareness' },
          { name: 'Build Interest', days: -30, focus: 'consideration' },
          { name: 'Drive Sales', days: -14, focus: 'conversion' },
          { name: 'Final Push', days: -7, focus: 'urgency' }
        ],
        budgetCurve: {
          '-45_to_-30': 0.25,
          '-30_to_-14': 0.40,
          '-14_to_-1': 0.35
        },
        tactics: {
          awareness: ['Event highlights', 'What to expect', 'Social proof'],
          conversion: ['Limited availability', 'Pricing incentives', 'FOMO messaging']
        }
      }
    };
    
    return benchmarks[eventType] || benchmarks.general;
  }
  
  /**
   * Helper: Score segment relevance
   */
  scoreSegment(segment, campaignGoal, dataContext) {
    let score = 0;
    
    // Size matters
    if (segment.size > 1000) score += 20;
    else if (segment.size > 100) score += 10;
    
    // Value concentration
    if (segment.value > dataContext.totalValue * 0.2) score += 30;
    
    // Goal alignment
    switch (campaignGoal) {
      case 'conversion':
        if (segment.intelligence?.conversionRate > 0.2) score += 40;
        break;
      case 'awareness':
        if (segment.intelligence?.reachPotential > 10000) score += 40;
        break;
      case 'retention':
        if (segment.intelligence?.churnRisk < 0.2) score += 40;
        break;
    }
    
    // Data confidence
    if (dataContext.confidence === 'high') score += 10;
    
    return score;
  }
}

module.exports = EventIntelligenceService;