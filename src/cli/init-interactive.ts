export function shouldRunWizard(
  argv: string[],
  isTTY: boolean = process.stdin.isTTY ?? false,
): boolean {
  const args = argv.slice(2).filter((a) => a !== 'init');
  if (!isTTY) return false;
  if (args.includes('--json')) return false;
  if (args.includes('--yes') || args.includes('-y')) return false;
  return true;
}
