async function testTranslation() {
  const sampleText = "What is Retrieval-Augmented Generation?\n\nAnswer:\nRAG uses embeddings and Pinecone for semantic retrieval. Someone with 10 years of engineering experience only needs to learn the AI part.";

  console.log("--- TESTING HINDI TRANSFORMATION ---");
  const resHindi = await fetch('http://localhost:3001/api/ai/transform-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sampleText, targetLanguage: 'Hindi' })
  });
  const dataHindi = await resHindi.json();
  console.log("STATUS:", resHindi.status);
  console.log("HINDI RESULT:\n", dataHindi.transformedText);

  console.log("\n--- TESTING HINGLISH TRANSFORMATION ---");
  const resHinglish = await fetch('http://localhost:3001/api/ai/transform-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sampleText, targetLanguage: 'Hinglish' })
  });
  const dataHinglish = await resHinglish.json();
  console.log("STATUS:", resHinglish.status);
  console.log("HINGLISH RESULT:\n", dataHinglish.transformedText);

  console.log("\n--- TESTING ENGLISH TRANSFORMATION ---");
  const resEnglish = await fetch('http://localhost:3001/api/ai/transform-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: dataHindi.transformedText, targetLanguage: 'English' })
  });
  const dataEnglish = await resEnglish.json();
  console.log("STATUS:", resEnglish.status);
  console.log("ENGLISH RESULT:\n", dataEnglish.transformedText);
}

testTranslation().catch(console.error);
