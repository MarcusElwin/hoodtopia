import { describe, it, expect } from 'vitest';
import {
  RecommendationItemSchema,
  RecommendationsResponseSchema,
  SearchResultsSchema,
  CustomDesignInputSchema,
  CustomDesignRefinementSchema,
} from './schemas';

describe('AI Schema Validation', () => {
  describe('RecommendationItemSchema', () => {
    it('should validate a valid recommendation item', () => {
      const validItem = {
        productName: 'Classic Comfort Hoodie',
        reason: 'Perfect for everyday wear',
        confidence: 0.95,
        highlightedFeatures: ['Soft cotton', 'Relaxed fit'],
      };

      const result = RecommendationItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('should reject confidence out of range', () => {
      const invalidItem = {
        productName: 'Classic Comfort Hoodie',
        reason: 'Perfect for everyday wear',
        confidence: 1.5,
        highlightedFeatures: ['Soft cotton'],
      };

      const result = RecommendationItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidItem = {
        productName: 'Classic Comfort Hoodie',
        confidence: 0.95,
      };

      const result = RecommendationItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe('RecommendationsResponseSchema', () => {
    it('should validate a valid recommendations response', () => {
      const validResponse = {
        recommendations: [
          {
            productName: 'Classic Comfort Hoodie',
            reason: 'Perfect for everyday wear',
            confidence: 0.95,
            highlightedFeatures: ['Soft cotton', 'Relaxed fit'],
          },
        ],
        followUpQuestion: 'What color do you prefer?',
      };

      const result = RecommendationsResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject empty recommendations array', () => {
      const invalidResponse = {
        recommendations: [],
      };

      const result = RecommendationsResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject more than 3 recommendations', () => {
      const invalidResponse = {
        recommendations: [
          {
            productName: 'Product 1',
            reason: 'Reason 1',
            confidence: 0.9,
            highlightedFeatures: ['Feature 1'],
          },
          {
            productName: 'Product 2',
            reason: 'Reason 2',
            confidence: 0.9,
            highlightedFeatures: ['Feature 2'],
          },
          {
            productName: 'Product 3',
            reason: 'Reason 3',
            confidence: 0.9,
            highlightedFeatures: ['Feature 3'],
          },
          {
            productName: 'Product 4',
            reason: 'Reason 4',
            confidence: 0.9,
            highlightedFeatures: ['Feature 4'],
          },
        ],
      };

      const result = RecommendationsResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should allow optional followUpQuestion', () => {
      const validResponse = {
        recommendations: [
          {
            productName: 'Classic Comfort Hoodie',
            reason: 'Perfect for everyday wear',
            confidence: 0.95,
            highlightedFeatures: ['Soft cotton'],
          },
        ],
      };

      const result = RecommendationsResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('SearchResultsSchema', () => {
    it('should validate a valid search result', () => {
      const validResult = {
        productNames: ['Classic Comfort Hoodie', 'Performance Hoodie'],
        isRelevant: true,
        searchIntent: 'Looking for comfortable hoodies',
      };

      const result = SearchResultsSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should allow empty product names array', () => {
      const validResult = {
        productNames: [],
        isRelevant: false,
      };

      const result = SearchResultsSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should require isRelevant boolean', () => {
      const invalidResult = {
        productNames: ['Classic Comfort Hoodie'],
        isRelevant: 'yes',
      };

      const result = SearchResultsSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should allow optional searchIntent', () => {
      const validResult = {
        productNames: ['Classic Comfort Hoodie'],
        isRelevant: true,
      };

      const result = SearchResultsSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });
  });

  describe('CustomDesignInputSchema length caps', () => {
    it('should accept a normal text design request', () => {
      const result = CustomDesignInputSchema.safeParse({
        type: 'text',
        description: 'A cosmic galaxy print with purple nebula',
      });
      expect(result.success).toBe(true);
    });

    it('should reject an oversized description', () => {
      const result = CustomDesignInputSchema.safeParse({
        type: 'text',
        description: 'x'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized base64 imageData', () => {
      const result = CustomDesignInputSchema.safeParse({
        type: 'image',
        imageData: 'A'.repeat(20_000_001),
      });
      expect(result.success).toBe(false);
    });

    it('should accept imageData within the cap', () => {
      const result = CustomDesignInputSchema.safeParse({
        type: 'image',
        imageData: 'A'.repeat(1000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CustomDesignRefinementSchema length caps', () => {
    it('should accept normal feedback', () => {
      const result = CustomDesignRefinementSchema.safeParse({
        generationId: 'abc-123',
        feedback: 'Make the logo bigger',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty feedback', () => {
      const result = CustomDesignRefinementSchema.safeParse({
        generationId: 'abc-123',
        feedback: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized feedback', () => {
      const result = CustomDesignRefinementSchema.safeParse({
        generationId: 'abc-123',
        feedback: 'x'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });
});
