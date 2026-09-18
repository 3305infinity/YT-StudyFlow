import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAndValidateResponse, type FormattedResponse } from './pipeline.js';

describe('AI Answer Quality & Validation Layer Unit Tests', () => {
  it('should strip raw SVG text markers and HTML tags from fields', () => {
    const raw: FormattedResponse = {
      directAnswer: 'Welcome! Fourier Transform converts time domain signals into frequency domain. <svg></svg> svg: fourier_icon',
      summary: 'Fourier Transform converts time domain signals into frequency domain.',
      explanation: 'The transform decomposes a complex signal into individual sine waves.',
      lectureContent: 'The transform decomposes a complex signal into individual sine waves.',
      steps: ['1. Input: time domain signal svg', '2. Output: frequency spectrum'],
      technicalInsight: 'Calculates the complex exponential integral.',
      additionalExplanation: 'Calculates the complex exponential integral.',
      applications: ['Audio processing'],
      generalKnowledge: '',
      keyTakeaways: ['Fourier Transform separates frequencies.'],
      sections: [],
      suggestedRelatedTopics: ['Signal Processing svg'],
      intent: 'explain',
      targetConcept: 'Fourier Transform',
      model: 'test-model',
    };

    const sanitized = sanitizeAndValidateResponse(raw);

    assert.ok(!sanitized.directAnswer.includes('svg'));
    assert.ok(!sanitized.directAnswer.includes('Welcome!'));
    assert.equal(sanitized.directAnswer, 'Fourier Transform converts time domain signals into frequency domain.');
    assert.equal(sanitized.steps[0], '1. Input: time domain signal.');
    assert.ok(!sanitized.suggestedRelatedTopics[0]?.includes('svg'));
  });

  it('should trim incomplete sentences resulting from token truncation gracefully', () => {
    const raw: FormattedResponse = {
      directAnswer: 'Fourier Transform converts a signal from time to frequency domain. It helps us analyze the frequency content separating the smoothie of',
      summary: 'Fourier Transform converts a signal.',
      explanation: 'It measures the intensity of frequencies.',
      lectureContent: 'It measures the intensity of frequencies.',
      steps: [],
      technicalInsight: '',
      additionalExplanation: '',
      applications: [],
      generalKnowledge: '',
      keyTakeaways: [],
      sections: [],
      suggestedRelatedTopics: [],
      intent: 'explain',
      targetConcept: 'Fourier Transform',
      model: 'test-model',
    };

    const sanitized = sanitizeAndValidateResponse(raw);

    // Should trim back to last full sentence
    assert.equal(sanitized.directAnswer, 'Fourier Transform converts a signal from time to frequency domain.');
  });

  it('should deduplicate directAnswer and explanation when overlapping', () => {
    const raw: FormattedResponse = {
      directAnswer: 'Fourier Transform converts signals from time domain to frequency domain.',
      summary: 'Fourier Transform converts signals from time domain to frequency domain.',
      explanation: 'Fourier Transform converts signals from time domain to frequency domain. It allows us to view individual frequency components.',
      lectureContent: 'Fourier Transform converts signals from time domain to frequency domain. It allows us to view individual frequency components.',
      steps: ['Input signal over time', 'Transform analysis', 'Output frequency spectrum', 'Interpret peaks'],
      technicalInsight: 'Uses Euler formula e^(-i*2pi*f*t).',
      additionalExplanation: 'Uses Euler formula e^(-i*2pi*f*t).',
      applications: ['Audio compression', 'Image processing'],
      generalKnowledge: '',
      keyTakeaways: ['Connects time and frequency domains.', 'Peaks represent dominant frequencies.'],
      sections: [],
      suggestedRelatedTopics: ['Discrete Fourier Transform'],
      intent: 'explain',
      targetConcept: 'Fourier Transform',
      model: 'test-model',
    };

    const sanitized = sanitizeAndValidateResponse(raw);

    assert.equal(sanitized.explanation, 'It allows us to view individual frequency components.');
    assert.equal(sanitized.sections.length, 5);
    assert.equal(sanitized.sections[0]?.type, 'explanation');
    assert.equal(sanitized.sections[1]?.type, 'steps');
    assert.equal(sanitized.sections[2]?.type, 'technical');
    assert.equal(sanitized.sections[3]?.type, 'application');
    assert.equal(sanitized.sections[4]?.type, 'recap');
  });

  it('should filter out low-value transcript copy-paste lines from keyTakeaways', () => {
    const raw: FormattedResponse = {
      directAnswer: 'Concept overview.',
      summary: 'Concept overview.',
      explanation: 'Simple explanation.',
      lectureContent: 'Simple explanation.',
      steps: [],
      technicalInsight: '',
      additionalExplanation: '',
      applications: [],
      generalKnowledge: '',
      keyTakeaways: [
        'Transcript chunk 1 contains info about audio.',
        'Time domain represents signal over time.',
        'Frequency domain represents magnitude of frequencies.'
      ],
      sections: [],
      suggestedRelatedTopics: [],
      intent: 'explain',
      targetConcept: 'Concept',
      model: 'test-model',
    };

    const sanitized = sanitizeAndValidateResponse(raw);

    assert.equal(sanitized.keyTakeaways.length, 2);
    assert.ok(!sanitized.keyTakeaways.some(t => t.includes('Transcript chunk')));
  });
});
