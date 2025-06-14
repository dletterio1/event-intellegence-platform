/**
 * Intelligence API Routes
 * Clean, intuitive endpoints for the Event Intelligence System
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Controllers
const intelligenceController = require('../../controllers/adbuilder/intelligence.controller');

// Middleware
const { AuthMiddleware } = require('../../middleware/auth.middleware');
const { OrganizationMiddleware } = require('../../middleware/organization.middleware');
const { validateRequest } = require('../../middleware/validation.middleware');
const { rateLimiter } = require('../../middleware/rateLimiter.middleware');

// Validation schemas
const {
  analyzeSchema,
  segmentCreationSchema,
  briefGenerationSchema
} = require('../../validators/intelligence.schemas');

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../../uploads/temp'));
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);
router.use(OrganizationMiddleware.validateOrganization);

// Apply rate limiting
const intelligenceRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 analysis requests per window
  message: 'Too many analysis requests. Please try again later.'
});

/**
 * Core Intelligence Routes
 */

// Upload and analyze customer data
router.post('/analyze',
  intelligenceRateLimit,
  upload.single('customerData'),
  validateRequest(analyzeSchema),
  intelligenceController.analyzeCustomerData
);

// Get analysis status/results
router.get('/status/:analysisId',
  intelligenceController.getAnalysisStatus
);

// Get quick insights without uploading data
router.get('/insights',
  intelligenceController.getQuickInsights
);

/**
 * Segmentation Routes
 */

// Create smart segments from existing data
router.post('/segments/create',
  validateRequest(segmentCreationSchema),
  intelligenceController.createSmartSegments
);

// Get segment recommendations
router.get('/segments/recommendations',
  intelligenceController.getSegmentRecommendations
);

// Preview segment before creation
router.post('/segments/preview',
  intelligenceController.previewSegment
);

/**
 * Campaign Intelligence Routes
 */

// Get timing recommendations
router.get('/timing',
  intelligenceController.getTimingRecommendations
);

// Get platform-specific targeting
router.get('/targeting/:platform',
  intelligenceController.getTargetingRecommendations
);

// Generate full campaign brief
router.post('/brief',
  validateRequest(briefGenerationSchema),
  intelligenceController.generateCampaignBrief
);

// Download campaign brief
router.get('/brief/:briefId/download',
  intelligenceController.downloadBrief
);

/**
 * Quick Action Routes (Demo-friendly)
 */

// One-click best audience for platform
router.post('/quick/audience/:platform',
  intelligenceController.quickCreateAudience
);

// Get instant recommendations for event
router.get('/quick/event-strategy',
  intelligenceController.getQuickEventStrategy
);

// What should I do right now?
router.get('/quick/next-action',
  intelligenceController.getNextBestAction
);

/**
 * Learning & Optimization Routes
 */

// Submit campaign results for learning
router.post('/campaigns/:campaignId/results',
  intelligenceController.submitCampaignResults
);

// Get optimization suggestions for running campaign
router.get('/campaigns/:campaignId/optimize',
  intelligenceController.getOptimizationSuggestions
);

/**
 * Benchmarking Routes
 */

// Compare against industry benchmarks
router.get('/benchmarks/:eventType',
  intelligenceController.getIndustryBenchmarks
);

// Get performance comparison
router.get('/performance/comparison',
  intelligenceController.getPerformanceComparison
);

/**
 * Export Routes
 */

// Export segment as CSV
router.get('/segments/:segmentId/export',
  intelligenceController.exportSegment
);

// Export intelligence report
router.get('/reports/intelligence/:analysisId',
  intelligenceController.exportIntelligenceReport
);

/**
 * Utility Routes
 */

// Validate CSV format before upload
router.post('/validate-csv',
  upload.single('sample'),
  intelligenceController.validateCSVFormat
);

// Get CSV template
router.get('/template/csv',
  intelligenceController.downloadCSVTemplate
);

// Health check
router.get('/health',
  (req, res) => res.json({ 
    status: 'healthy', 
    service: 'event-intelligence',
    version: '1.0.0'
  })
);

module.exports = router;

/**
 * Route Documentation
 * 
 * BASE PATH: /api/v1/adbuilder/intelligence
 * 
 * QUICK START FLOW:
 * 1. GET /insights - Get immediate value without data
 * 2. POST /analyze - Upload CSV for deep analysis
 * 3. GET /quick/next-action - What to do right now
 * 
 * FULL FLOW:
 * 1. POST /analyze - Upload customer data
 * 2. GET /status/:id - Check analysis progress
 * 3. POST /segments/create - Create audiences
 * 4. GET /timing - Get campaign calendar
 * 5. GET /targeting/:platform - Get platform config
 * 6. POST /brief - Generate full brief
 * 
 * OPTIMIZATION FLOW:
 * 1. POST /campaigns/:id/results - Submit results
 * 2. GET /campaigns/:id/optimize - Get improvements
 * 3. GET /performance/comparison - Benchmark
 */