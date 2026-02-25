type ClientSearchOptionLike = {
  label: string;
  hint?: string;
  searchText?: string;
  disabled?: boolean;
};

export function normalizeClientSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function filterClientSelectOptions<T extends ClientSearchOptionLike>(
  options: T[],
  searchTerm: string,
): T[] {
  const normalizedSearchTerm = normalizeClientSearchText(searchTerm);
  const digitsSearchTerm = extractDigits(searchTerm);
  const shouldUseDigitsSearch = digitsSearchTerm.length > 0 && !/[a-z]/i.test(normalizedSearchTerm);

  if (!normalizedSearchTerm && !shouldUseDigitsSearch) return options;

  return options.filter((option) => {
    const rawSearchableText = `${option.label} ${option.hint || ''} ${option.searchText || ''}`.trim();
    const normalizedSearchableText = normalizeClientSearchText(rawSearchableText);
    if (normalizedSearchTerm && normalizedSearchableText.includes(normalizedSearchTerm)) {
      return true;
    }
    if (shouldUseDigitsSearch) {
      const digitsInOption = extractDigits(rawSearchableText);
      if (digitsInOption.includes(digitsSearchTerm)) {
        return true;
      }
    }
    return false;
  });
}

export function getNextEnabledOptionIndex<T extends Pick<ClientSearchOptionLike, 'disabled'>>(
  options: T[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1;

  let index = currentIndex;
  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index]?.disabled) {
      return index;
    }
  }

  return currentIndex;
}
