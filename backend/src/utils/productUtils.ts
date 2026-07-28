export function getEmojiForCategory(category: string, name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) return '🍅';
  if (lower.includes('maïs') || lower.includes('mais')) return '🌽';
  if (lower.includes('manioc')) return '🥔';
  if (lower.includes('plantain') || lower.includes('banane')) return '🍌';
  if (lower.includes('poivron')) return '🫑';
  if (lower.includes('arachide')) return '🥜';
  if (lower.includes('ananas')) return '🍍';
  if (category === 'Légumes') return '🥗';
  if (category === 'Céréales') return '🌾';
  if (category === 'Tubercules') return '🥔';
  if (category === 'Fruits') return '🍍';
  return '🌱';
}

export function getImageUrlForProduct(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop';
  if (lower.includes('maïs') || lower.includes('mais')) return 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop';
  if (lower.includes('manioc')) return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop';
  if (lower.includes('plantain') || lower.includes('banane')) return 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&auto=format&fit=crop';
  if (lower.includes('poivron')) return 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop';
  if (lower.includes('arachide')) return 'https://images.unsplash.com/photo-1567892906800-47120cb95dfd?w=600&auto=format&fit=crop';
  if (lower.includes('ananas')) return 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&auto=format&fit=crop';
  return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
}
