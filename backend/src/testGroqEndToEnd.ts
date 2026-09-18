import { chatStructuredService } from './services/chatStructured.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTests() {
  console.log('====================================================');
  console.log('     TESTING GROQ FINAL ANSWER GENERATION FLOW      ');
  console.log('====================================================\n');

  const testCases = [
    {
      name: 'Test 1 — Lecture-grounded',
      question: 'Summarize the main ideas in 3 points',
      chunks: [
        {
          id: 'c1',
          text: 'The Fourier Transform decomposes a time-domain signal into its constituent frequency components. This allows engineers to analyze which frequencies are dominant in a complex wave.',
          startTime: 30,
          endTime: 90,
          videoId: 'v1',
          videoTitle: 'Signal Processing Basics',
        },
        {
          id: 'c2',
          text: 'The Continuous Fourier Transform applies to infinite signals, whereas the Discrete Fourier Transform (DFT) works on digital sampled signals in computers.',
          startTime: 91,
          endTime: 150,
          videoId: 'v1',
          videoTitle: 'Signal Processing Basics',
        },
        {
          id: 'c3',
          text: 'The Fast Fourier Transform (FFT) is an efficient algorithmic implementation of the DFT that reduces computational complexity from O(N^2) to O(N log N).',
          startTime: 151,
          endTime: 210,
          videoId: 'v1',
          videoTitle: 'Signal Processing Basics',
        },
      ],
    },
    {
      name: 'Test 2 — Lecture concept',
      question: 'Explain the hardest concept simply',
      chunks: [
        {
          id: 'c4',
          text: 'The most difficult concept here is phase alignment in inverse DFT reconstruction. If the phase angles of individual sinusoidal components are not perfectly preserved, the reconstructed time signal becomes distorted even if the magnitude spectrum is identical.',
          startTime: 220,
          endTime: 300,
          videoId: 'v1',
          videoTitle: 'Signal Processing Basics',
        },
      ],
    },
    {
      name: 'Test 3 — Outside transcript',
      question: 'What is quantum entanglement?',
      chunks: [],
    },
    {
      name: 'Test 4 — Partial transcript coverage',
      question: 'What is backpropagation and how is it used in neural networks?',
      chunks: [
        {
          id: 'c5',
          text: 'In neural networks, gradient descent updates weights. Backpropagation computes the partial derivatives of the loss function with respect to each weight.',
          startTime: 400,
          endTime: 450,
          videoId: 'v2',
          videoTitle: 'Deep Learning Intro',
        },
      ],
    },
    {
      name: 'Test 5 — Simple factual question',
      question: 'What is a signal?',
      chunks: [
        {
          id: 'c6',
          text: 'A signal is a function that conveys information about a phenomenon or physical quantity over time or space.',
          startTime: 10,
          endTime: 25,
          videoId: 'v1',
          videoTitle: 'Signal Processing Basics',
        },
      ],
    },
  ];

  for (const tc of testCases) {
    console.log(`\n--- ${tc.name} ---`);
    console.log(`Question: "${tc.question}"`);
    console.log(`Chunks Provided: ${tc.chunks.length}`);

    const start = Date.now();
    try {
      const res = await chatStructuredService.send({
        userId: 'dev-user',
        question: tc.question,
        videoId: tc.chunks[0]?.videoId || 'v-general',
        videoTitle: tc.chunks[0]?.videoTitle || 'General Topic',
        mode: 'concise',
        chunks: tc.chunks,
      });

      const duration = Date.now() - start;
      console.log(`✓ Status: SUCCESS (${duration}ms)`);
      console.log(`Groq Model Used: ${res.model}`);
      console.log(`Coverage: ${res.coverage}`);
      console.log(`Sources Count: ${res.sources.length}`);
      console.log(`Tokens Used: ${res.tokensUsed ?? 'N/A'}`);
      console.log(`Direct Answer:\n${res.directAnswer}`);
      console.log(`Full Response Content:\n${res.lectureContent || res.generalKnowledge}\n`);
    } catch (err) {
      console.error(`✗ Status: FAILED`, err);
    }
  }

  console.log('====================================================');
  console.log('              ALL TESTS COMPLETED                   ');
  console.log('====================================================');
}

runTests().catch(console.error);
