async function findFluxModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  const data = await response.json();
  const fluxModels = data.data.filter(m => m.id.toLowerCase().includes("flux"));
  console.log("Flux Models found on OpenRouter:");
  fluxModels.forEach(m => console.log(`- ${m.id}`));
}

findFluxModels();
