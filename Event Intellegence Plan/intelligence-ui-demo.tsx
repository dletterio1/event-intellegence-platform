import React, { useState, useCallback } from 'react';
import { Upload, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Users, TrendingUp, Target, Zap, DollarSign, Clock, ChevronRight, Check, AlertCircle } from 'lucide-react';

const EventIntelligenceDemo = () => {
  const [currentStep, setCurrentStep] = useState('upload');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState('conversion');
  
  // Mock data for demo
  const mockAnalysis = {
    segments: [
      {
        id: 'early_planners',
        name: 'Early Bird Professionals',
        size: 2847,
        value: '$142,350',
        score: 95,
        description: 'Buy tickets 45+ days in advance',
        color: '#3B82F6'
      },
      {
        id: 'vip_loyalists',
        name: 'VIP Loyalists',
        size: 432,
        value: '$86,400',
        score: 88,
        description: 'Premium ticket buyers, 5+ events/year',
        color: '#8B5CF6'
      },
      {
        id: 'last_minute',
        name: 'Last Minute Deciders',
        size: 1893,
        value: '$56,790',
        score: 72,
        description: 'Purchase within 7 days of event',
        color: '#10B981'
      },
      {
        id: 'group_coordinators',
        name: 'Group Coordinators',
        size: 654,
        value: '$98,100',
        score: 83,
        description: 'Average 6 tickets per purchase',
        color: '#F59E0B'
      }
    ],
    timing: {
      recommendedStart: '45 days before',
      phases: [
        { name: 'Announcement', days: -45, budget: 20 },
        { name: 'Early Bird', days: -30, budget: 35 },
        { name: 'Main Push', days: -14, budget: 30 },
        { name: 'Final Sprint', days: -7, budget: 15 }
      ]
    },
    recommendations: [
      {
        priority: 'high',
        action: 'Target Early Bird Professionals',
        impact: '3.2x ROI expected',
        effort: 'low'
      },
      {
        priority: 'high',
        action: 'Create VIP Lookalike Audience',
        impact: 'Find 10K+ similar high-value customers',
        effort: 'low'
      },
      {
        priority: 'medium',
        action: 'Exclude chronic non-converters',
        impact: 'Save 20% of ad budget',
        effort: 'low'
      }
    ]
  };
  
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setAnalysisResults(mockAnalysis);
            setCurrentStep('results');
          }, 500);
        }
      }, 200);
    }
  }, []);
  
  const renderUploadStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Transform Your Customer Data Into Smart Audiences
        </h2>
        <p className="text-lg text-gray-600">
          Upload your customer list and discover hidden patterns that drive ticket sales
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Campaign Goal
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'conversion', label: 'Sell Tickets', icon: DollarSign },
              { id: 'awareness', label: 'Build Awareness', icon: TrendingUp },
              { id: 'retention', label: 'Fill Last Seats', icon: Users }
            ].map(goal => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedGoal === goal.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <goal.icon className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm">{goal.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          {uploadProgress === 0 ? (
            <>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Drag & drop your customer CSV here, or click to browse
              </p>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Select File
              </label>
              <p className="text-xs text-gray-500 mt-4">
                Supports CSV and Excel files up to 50MB
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {uploadProgress < 30 && "Reading file..."}
                {uploadProgress >= 30 && uploadProgress < 60 && "Analyzing patterns..."}
                {uploadProgress >= 60 && uploadProgress < 90 && "Building segments..."}
                {uploadProgress >= 90 && "Generating insights..."}
              </p>
            </div>
          )}
        </div>
        
        {uploadProgress === 0 && (
          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700">
              No data? Get insights from industry benchmarks →
            </button>
          </div>
        )}
      </div>
    </div>
  );
  
  const renderResultsStep = () => (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Your Event Intelligence Report
        </h2>
        <p className="text-lg text-gray-600">
          Based on analysis of 5,826 customers
        </p>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 mb-8 text-white">
        <h3 className="text-xl font-semibold mb-4">Recommended Actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {analysisResults.recommendations.map((rec, idx) => (
            <div key={idx} className="bg-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <Zap className="w-5 h-5" />
                <span className={`text-xs px-2 py-1 rounded ${
                  rec.priority === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                }`}>
                  {rec.priority}
                </span>
              </div>
              <h4 className="font-medium mb-1">{rec.action}</h4>
              <p className="text-sm opacity-90 mb-2">{rec.impact}</p>
              <button className="text-sm underline hover:no-underline">
                Do this now →
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Segments */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Smart Segments Discovered</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {analysisResults.segments.map(segment => (
            <div key={segment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-lg">{segment.name}</h4>
                  <p className="text-sm text-gray-600">{segment.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: segment.color }}>
                    {segment.score}
                  </div>
                  <div className="text-xs text-gray-500">Score</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <Users className="w-4 h-4 text-gray-400 inline mr-1" />
                  <span className="text-sm">{segment.size.toLocaleString()} people</span>
                </div>
                <div>
                  <DollarSign className="w-4 h-4 text-gray-400 inline mr-1" />
                  <span className="text-sm">{segment.value} value</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                  Create Audience
                </button>
                <button className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Timing */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Campaign Timeline</h3>
        <div className="mb-4">
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <Clock className="w-4 h-4 mr-1" />
            Start campaign {analysisResults.timing.recommendedStart}
          </div>
        </div>
        
        <div className="space-y-3">
          {analysisResults.timing.phases.map((phase, idx) => (
            <div key={idx} className="flex items-center">
              <div className="w-32 text-sm font-medium">{phase.name}</div>
              <div className="flex-1 mx-4">
                <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${phase.budget}%` }}
                  />
                </div>
              </div>
              <div className="w-20 text-right text-sm text-gray-600">
                {phase.budget}% budget
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Ready to Launch?</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <button className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left">
            <Target className="w-8 h-8 text-blue-600 mb-2" />
            <h4 className="font-medium">Create Meta Campaign</h4>
            <p className="text-sm text-gray-600">Launch on Facebook & Instagram</p>
          </button>
          <button className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left">
            <Calendar className="w-8 h-8 text-green-600 mb-2" />
            <h4 className="font-medium">Download Calendar</h4>
            <p className="text-sm text-gray-600">Get your campaign timeline</p>
          </button>
          <button className="p-4 bg-white rounded-lg hover:shadow-md transition-shadow text-left">
            <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
            <h4 className="font-medium">View Full Report</h4>
            <p className="text-sm text-gray-600">Deep dive into insights</p>
          </button>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}>
                {currentStep === 'results' ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className="ml-2 font-medium">Upload Data</span>
            </div>
            
            <ChevronRight className="text-gray-300" />
            
            <div className={`flex items-center ${currentStep === 'results' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="ml-2 font-medium">Get Intelligence</span>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        {currentStep === 'upload' && renderUploadStep()}
        {currentStep === 'results' && renderResultsStep()}
      </div>
    </div>
  );
};

export default EventIntelligenceDemo;