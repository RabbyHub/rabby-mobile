export async function checkHostReachable(target: string) {
  try {
    const response = await fetch(target, { method: 'HEAD' }); // Use HEAD for efficiency
    return response.ok || response.status === 200;
  } catch (error) {
    console.error('Error checking domain reachability:', error);
    return false;
  }
}
