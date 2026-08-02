async function test() {
  const res = await fetch('https://leetcode.com/princesinghrj786/');
  const text = await res.text();
  console.log('HTML Length:', text.length);
  const nextDataMatch = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (nextDataMatch) {
    const data = JSON.parse(nextDataMatch[1]);
    console.log('Found NextJS Data.');
    const queries = data.props?.pageProps?.dehydratedState?.queries || [];
    console.log('Queries prefetched:', queries.map(q => q.queryKey));
    
    // Search the whole text for 'two-sum'
    console.log('Contains two-sum:', text.includes('two-sum'));
  } else {
    console.log('No __NEXT_DATA__ found');
  }
}
test();
