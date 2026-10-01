export function sortProductsByName<T>(
  items: T[],
  nameSelector: (item: T) => string = (item: any) => item.name
): T[] {
  return [...items].sort((a, b) => {
    const nameA = nameSelector(a) || '';
    const nameB = nameSelector(b) || '';

    const parse = (name: string) => {
      // Matches patterns like "iPhone 18 Pro 256GB", "Galaxy S24 1TB"
      const match = name.match(/^(.*?)\s*(\d+)\s*(GB|TB)\s*$/i);
      if (match) {
        const baseName = match[1].trim();
        const value = parseInt(match[2], 10);
        const unit = match[3].toUpperCase();
        let storageGB = value;
        if (unit === 'TB') storageGB = value * 1024;
        return { baseName, storageGB };
      }
      return { baseName: name, storageGB: 0 };
    };

    const parsedA = parse(nameA);
    const parsedB = parse(nameB);

    // If base names are different, sort alphabetically by base name
    if (parsedA.baseName !== parsedB.baseName) {
      return parsedA.baseName.localeCompare(parsedB.baseName);
    }
    
    // If base names are the same, sort by storage size (GB)
    return parsedA.storageGB - parsedB.storageGB;
  });
}
