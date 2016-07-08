import random
import re
from heapq import nsmallest

SHARDS = 10000
URLS_PER_SHARD = 100

def sample(it, k):
  return (x for _, x in nsmallest(k, ((random.random(), x) for x in it)))

print 'Reading all_urls...'
with open('all_urls') as f:
  sampled_urls = (re.search(r'^n(\d+)_\d+\s+([^\s]+)', sampled_line).group(1, 2)
                  for sampled_line in sample((line for line in f), SHARDS * URLS_PER_SHARD))

print 'Reading data.noun...'
with open('data.noun') as f:
  wordnet_entries = dict(
      re.search(r'^(\d+) \w+ n \w+ ([^\s]+)', line).group(1, 2)
      for line in f if line[0] != ' ')

print 'Joining...'
sampled_urls = ((id, wordnet_entries[id], url) for id, url in sampled_urls)

print 'Writing sharded files...'
for i in xrange(SHARDS):
  with open('urls_%s' % i, 'w') as f:
    for j in xrange(URLS_PER_SHARD):
      f.write(' '.join(next(sampled_urls)) + '\n')

