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
        // Remove the storage part to create a comparable base name
        const baseName = name.replace(match[0], '').replace(/\s+/g, ' ').trim();
        const value = parseInt(match[1], 10);
        const unit = match[2].toUpperCase();
        let storageGB = value;
        if (unit === 'TB') storageGB = value * 1024;
        return { baseName, storageGB };
      }
      return { baseName: name, storageGB: 0 };
    };

    const parsedA = parse(nameA);
    const parsedB = parse(nameB);

    // If base names are different, sort them naturally (so iPhone 9 comes before iPhone 10)
    if (parsedA.baseName !== parsedB.baseName) {
      return parsedA.baseName.localeCompare(parsedB.baseName, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    }
    
    // If base names are the same, sort by storage size
    return parsedA.storageGB - parsedB.storageGB;
  });
}
