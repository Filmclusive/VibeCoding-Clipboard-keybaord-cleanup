export function computeSignature(value: string): string {
  let hash = 0;
  const length = value.length;
  for (let i = 0; i < length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `${hash}:${length}`;
}
