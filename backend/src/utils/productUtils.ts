export function getEmojiForCategory(category: string, name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) return '🍅';
  if (lower.includes('maïs') || lower.includes('mais')) return '🌽';
  if (lower.includes('manioc')) return '🥔';
  if (lower.includes('plantain') || lower.includes('banane')) return '🍌';
  if (lower.includes('poivron') || lower.includes('piment')) return '🫑';
  if (lower.includes('arachide') || lower.includes('pistache')) return '🥜';
  if (lower.includes('ananas')) return '🍍';
  if (lower.includes('ndolé') || lower.includes('ndole') || lower.includes('légume')) return '🥬';
  if (lower.includes('macabo') || lower.includes('igname') || lower.includes('patate')) return '🥔';
  if (lower.includes('safou') || lower.includes('prune')) return '🫐';
  if (lower.includes('haricot')) return '🫘';
  if (lower.includes('cacao')) return '🍫';
  if (lower.includes('café') || lower.includes('cafe')) return '☕';
  if (lower.includes('oignon')) return '🧅';
  if (lower.includes('gombo')) return '🥒';

  if (category === 'Légumes') return '🥬';
  if (category === 'Céréales') return '🌾';
  if (category === 'Tubercules') return '🥔';
  if (category === 'Fruits') return '🍍';
  if (category === 'Légumineuses') return '🫘';
  if (category === 'Cultures de rente') return '💰';
  return '🌱';
}

export function getImageUrlForProduct(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('tomate')) return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop';
  if (lower.includes('maïs') || lower.includes('mais')) return 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop';
  if (lower.includes('manioc')) return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop';
  if (lower.includes('plantain') || lower.includes('banane')) return 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=600&auto=format&fit=crop';
  if (lower.includes('poivron') || lower.includes('piment')) return 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop';
  if (lower.includes('arachide') || lower.includes('pistache')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  if (lower.includes('ananas')) return 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&auto=format&fit=crop';
  if (lower.includes('ndolé') || lower.includes('ndole')) return 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=600&auto=format&fit=crop';
  if (lower.includes('macabo') || lower.includes('taro')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  if (lower.includes('igname')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  if (lower.includes('patate')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  if (lower.includes('safou') || lower.includes('prune')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  if (lower.includes('haricot')) return 'https://images.unsplash.com/photo-1551326844-4df70f78d0e9?w=600&auto=format&fit=crop';
  if (lower.includes('cacao')) return 'https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?w=600&auto=format&fit=crop';
  if (lower.includes('café') || lower.includes('cafe')) return 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?w=600&auto=format&fit=crop';
  if (lower.includes('oignon')) return 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop';
  if (lower.includes('gombo')) return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
  
  return 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=600&auto=format&fit=crop';
}
