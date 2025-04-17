const request = require('supertest');
const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const logger = require('../logger');

// Mock the BigQuery client
jest.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: jest.fn().mockImplementation(() => {
      return {
        query: jest.fn().mockResolvedValue([
          [
            {
              user_id: '123',
              name: 'Test User',
              tasks_completed_percentage: 85.5,
              prompts_sent: 120,
              daily_sentiment: 'Positive',
              peer_feedback_sentiment: 'Very Positive',
              work_product_score: 0.85,
              comprehension_score: 0.9
            }
          ]
        ])
      };
    })
  };
});

// Mock the logger
jest.mock('../logger', () => {
  return {
    info: jest.fn(),
    error: jest.fn()
  };
});

// Import the app
const app = require('../index');

describe('API Endpoints', () => {
  describe('GET /api/builders', () => {
    it('should return 400 if startDate or endDate is missing', async () => {
      const response = await request(app).get('/api/builders');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return builder data when valid dates are provided', async () => {
      const response = await request(app)
        .get('/api/builders')
        .query({ startDate: '2023-01-01', endDate: '2023-12-31' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('user_id');
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('GET /api/builders/:userId/details', () => {
    it('should return 400 if required parameters are missing', async () => {
      const response = await request(app).get('/api/builders/123/details');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if type is invalid', async () => {
      const response = await request(app)
        .get('/api/builders/123/details')
        .query({ type: 'invalid', startDate: '2023-01-01', endDate: '2023-12-31' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return work product details when valid parameters are provided', async () => {
      const response = await request(app)
        .get('/api/builders/123/details')
        .query({ type: 'workProduct', startDate: '2023-01-01', endDate: '2023-12-31' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return comprehension details when valid parameters are provided', async () => {
      const response = await request(app)
        .get('/api/builders/123/details')
        .query({ type: 'comprehension', startDate: '2023-01-01', endDate: '2023-12-31' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return peer feedback details when valid parameters are provided', async () => {
      const response = await request(app)
        .get('/api/builders/123/details')
        .query({ type: 'peerFeedback', startDate: '2023-01-01', endDate: '2023-12-31' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
}); 