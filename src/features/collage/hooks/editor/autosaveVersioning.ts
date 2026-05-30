export function shouldApplyAutosaveResult(requestId: number, latestRequestId: number): boolean {
  return requestId === latestRequestId;
}
