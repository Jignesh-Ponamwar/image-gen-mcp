async function testWorker() {
  const url = "https://image-gen-mcp.workers.dev/health";
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    console.log(`Body: ${await response.text()}`);
  } catch (e) {
    console.error(`Fetch error: ${e.message}`);
  }
}

testWorker();
