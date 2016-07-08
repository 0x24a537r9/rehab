# ImageNet / WordNet files
All image URLs have been sampled from [ImageNet](http://image-net.org/download-imageurls) with labeling provided by [WordNet](https://wordnet.princeton.edu/wordnet/download/).

In order to limit download sizes, I created a simple Python script to sample 1 million URLs from the ImageNet dataset, join them with their corresponding WordNet entries, and shard the dataset into 1000 separate files of 100 URLs each.
