/**
 * Unit tests for the website tracking pixel snippet generator.
 * Extracted from WebsiteTrackingSettings to allow isolated testing.
 */
import { describe, it, expect } from 'vitest';

// Inline the pure function so we can test without importing the full component
function buildSnippet(pixelId, supabaseUrl, anonKey) {
  return `<!-- LotLine Tracking Pixel -->
<script>
(function(){
  var PID='${pixelId}';
  var URL='${supabaseUrl}/rest/v1/web_visits';
  var KEY='${anonKey}';
  function uid(k){try{var v=localStorage.getItem(k);if(!v){v=crypto.randomUUID();localStorage.setItem(k,v);}return v;}catch(e){return 'anon';}}
  function sid(k){try{var v=sessionStorage.getItem(k);if(!v){v=crypto.randomUUID();sessionStorage.setItem(k,v);}return v;}catch(e){return 'anon';}}
  var payload=JSON.stringify({pixel_id:PID,url:location.href,referrer:document.referrer||null,user_agent:navigator.userAgent,screen_width:screen.width,screen_height:screen.height,visitor_id:uid('_llv'),session_id:sid('_lls')});
  if(navigator.sendBeacon){navigator.sendBeacon(URL+'?apikey='+KEY,new Blob([payload],{type:'application/json'}));}
  else{fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY,'Prefer':'return=minimal'},body:payload}).catch(function(){});}
})();
<\/script>`;
}

const TEST_PIXEL  = '00000000-0000-0000-0000-000000000001';
const TEST_URL    = 'https://abcxyz.supabase.co';
const TEST_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

describe('buildSnippet', () => {
  const snippet = buildSnippet(TEST_PIXEL, TEST_URL, TEST_KEY);

  it('includes the pixel ID', () => {
    expect(snippet).toContain(TEST_PIXEL);
  });

  it('targets the web_visits REST endpoint', () => {
    expect(snippet).toContain(`${TEST_URL}/rest/v1/web_visits`);
  });

  it('includes the anon key', () => {
    expect(snippet).toContain(TEST_KEY);
  });

  it('uses sendBeacon with fetch fallback', () => {
    expect(snippet).toContain('navigator.sendBeacon');
    expect(snippet).toContain('fetch(URL');
  });

  it('collects visitor_id and session_id', () => {
    expect(snippet).toContain('_llv');
    expect(snippet).toContain('_lls');
  });

  it('collects screen dimensions', () => {
    expect(snippet).toContain('screen.width');
    expect(snippet).toContain('screen.height');
  });

  it('collects referrer', () => {
    expect(snippet).toContain('document.referrer');
  });

  it('is under 2KB unminified', () => {
    expect(snippet.length).toBeLessThan(2048);
  });

  it('wraps in an IIFE', () => {
    expect(snippet).toContain('(function(){');
    expect(snippet).toContain('})();');
  });
});
