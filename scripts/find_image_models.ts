async function findImageModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  const data = await response.json();
  // Filter for models that have image output or similar
  const imageModels = data.data.filter(m => 
    m.id.toLowerCase().includes("flux") || 
    m.id.toLowerCase().includes("stable-diffusion") ||
    m.id.toLowerCase().includes("midjourney") ||
    m.name.toLowerCase().includes("image")
  );
  console.log("Image-related Models found on OpenRouter:");
  imageModels.forEach(m => console.log(`- ${m.id} (${m.name})`));
}

findImageModels();
