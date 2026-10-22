export interface DialogFocusable {
  focus(): void
}

export interface DialogFocusContainer {
  contains(node: unknown): boolean
}

export function dialogTabWrapTarget(
  activeElement: unknown,
  focusable: DialogFocusable[],
  backwards: boolean,
  dialog: DialogFocusContainer,
): DialogFocusable | undefined {
  if (focusable.length === 0) return undefined
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!dialog.contains(activeElement)) return backwards ? last : first
  if (backwards && activeElement === first) return last
  if (!backwards && activeElement === last) return first
  return undefined
}
