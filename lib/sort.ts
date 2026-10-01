export function sortProductsByName<T>(
  items: T[],
  nameSelector: (item: T) => string = (item: any) => item.name
): T[] {
  return [...items].sort((a, b) => {
    const nameA = nameSelector(a) || '';
    const nameB = nameSelector(b) || '';

    const parse = (name: string) => {
      // Find storage like "256GB", "1 TB" anywhere in the string
      const match = name.match(/(\d+)\s*(GB|TB)\b/i);
      if (match) {
        const fullMatch = match[0];
        const matchIndex = match.index!;
        
        // Everything before the storage is the prefix (e.g., "IPHONE 18 PRO")
        const prefix = name.substring(0, matchIndex).trim();
        
        // Everything after the storage is the suffix (e.g., "(BLACK)")
        const suffix = name.substring(matchIndex + fullMatch.length).trim();
        
        const value = parseInt(match[1], 10);
        const unit = match[2].toUpperCase();
        let storageGB = value;
        if (unit === 'TB') storageGB = value * 1024;
        
        return { prefix, storageGB, suffix };
      }
      
      // If no storage found, treat the whole name as prefix
      return { prefix: name, storageGB: 0, suffix: '' };
    };

    const parsedA = parse(nameA);
    const parsedB = parse(nameB);

    // 1. Sort by Prefix (e.g. "IPHONE 18 PRO") naturally
    if (parsedA.prefix !== parsedB.prefix) {
      return parsedA.prefix.localeCompare(parsedB.prefix, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    }
    
    // 2. Sort by Storage Size numerically (e.g. 256 < 512)
    if (parsedA.storageGB !== parsedB.storageGB) {
      return parsedA.storageGB - parsedB.storageGB;
    }
    
    // 3. Sort by Suffix (e.g. "(BLACK)" vs "(BURGUNDY)") naturally
    return parsedA.suffix.localeCompare(parsedB.suffix, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });
}
