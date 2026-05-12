export function buildSimulationPrompts(opts: {
  category?: string;
  region?: string;
  luxury?: boolean;
}): string[] {
  const cat = opts.category?.trim() || "this category";
  const region = opts.region?.trim() || "my region";
  const lux = opts.luxury ? "luxury " : "";
  return [
    `What are the best ${cat} products to buy in 2026?`,
    `Best ${lux}${cat} for everyday use in ${region}`,
    `Top-rated ${cat} with strong reviews and clear specs`,
    `Compare the leading ${cat} options — what should I pick?`,
    `Most trustworthy ${lux}${cat} brands and products right now`,
    `Best value ${cat} that still feels premium in ${region}`,
  ];
}

export function buildBrandRankQueries(opts: {
  category?: string;
  region?: string;
  luxury?: boolean;
}): string[] {
  const cat = opts.category?.trim() || "this product category";
  const region = opts.region?.trim() || "my region";
  const lux = opts.luxury ? "luxury " : "";
  return [
    `I'm shopping for ${cat} — what should I look for?`,
    `Best ${lux}${cat} recommendations in ${region} in 2026`,
    `Which ${cat} products are most recommended by experts?`,
    `Help me choose a ${cat} with clear sizing, materials, and care instructions`,
    `What ${cat} products have the best customer satisfaction signals?`,
    `Compare popular ${cat} options for durability and warranty`,
    `What are emerging ${cat} trends I should know before buying?`,
    `Best ${lux}${cat} for gifting with premium packaging`,
    `Which ${cat} listings are easiest to understand quickly?`,
    `Top ${cat} picks if I care about detailed product specs`,
  ];
}
