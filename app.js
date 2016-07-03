$(function() {
  var $workspace = $('.workspace');
  var $nextButton = $('button.next');

  var imageUrlsCached = [];
  var imageUrlsLoading = [];
  var imageUrlsQueued = [];
  var isWaitingForImage = false;
  var isWaitingForImageUrls = false;

  var MIN_IMAGES_CACHED_OR_LOADING = 10;
  var MAX_IMAGES_LOADING = 10;
  var MIN_IMAGES_QUEUED = 10;

  $nextButton.click(showNextImage);
  $nextButton.click();


  function printStatus() {
    console.debug('Cached: ' + imageUrlsCached.length + ', ' +
                  'Loading: ' + imageUrlsLoading.length + ', ' +
                  'Queued: ' + imageUrlsQueued.length);
  }


  function showNextImage() {
    printStatus();
    cacheImagesIfNeeded();
    if (imageUrlsCached.length <= 0) {
      isWaitingForImage = true;
      console.warn('Ran out of cached images. Waiting for images to load...');
      return;
    }

    var $polaroid = $('<div class="polaroid before"><img></div>');
    $polaroid.css('transform', 'translate(-50%, -50%) rotate(' + (Math.random() * 10 - 5) + 'deg)');

    var $img = $polaroid.find('img');
    $img.attr('src', imageUrlsCached.pop());
    $polaroid.appendTo($workspace);
    setTimeout(function() { $polaroid.removeClass('before'); }, 50);
  }


  function cacheImagesIfNeeded() {
    if (imageUrlsCached.length + imageUrlsLoading.length >= MIN_IMAGES_CACHED_OR_LOADING) {
      return;
    }

    console.debug('Loading a batch of new images.');
    while (imageUrlsLoading.length < MAX_IMAGES_LOADING) {
      queueImagesIfNeeded();
      if (imageUrlsQueued.length <= 0) {
        console.warn('Ran out of queued image URLs. Waiting for image URLs to load...');
        return;
      }

      var imageUrl = imageUrlsQueued.pop();
      var imgEl = new Image();
      var timeout = setTimeout(handleImageTimeout.bind(null, imgEl), 5000);
      imgEl.onload = handleImageLoad.bind(null, imgEl, timeout);
      imgEl.onerror = handleImageError.bind(null, imgEl, timeout);
      imgEl.src = imageUrl;
      imageUrlsLoading.push(imageUrl);
      console.debug('Loading image: ' + imageUrl);
    }
  }


  function handleImageLoad(imgEl, timeout) {
    console.debug('Loaded image: ' + imgEl.src);

    // Add to imageUrlsCached.
    clearTimeout(timeout);
    removeItem(imageUrlsLoading, imgEl.src);
    if (imgEl.width < 100 || imgEl.height < 100) {
      console.warn('Rejected image for being too small: ' + imgEl.src);
      return;
    } else if (/static.flickr.com/i.test(imgEl.src) && imgEl.width == 500 && imgEl.height == 374) {
      console.warn('Rejected image for probably being a flickr "no longer available" image: ' + imgEl.src);
      return;
    }

    imageUrlsCached.push(imgEl.src);
    printStatus();

    // Show the next image if we were waiting on it.
    if (isWaitingForImage) {
      isWaitingForImage = false;
      showNextImage();
    }
  }


  function handleImageError(imgEl, timeout) {
    console.warn('Image errored out: ' + imgEl.src);
    removeItem(imageUrlsLoading, imgEl.src);
  }


  function handleImageTimeout(imgEl) {
    console.warn('Image timed out: ' + imgEl.src);
    removeItem(imageUrlsLoading, imgEl.src);
  }


  function queueImagesIfNeeded() {
    if (imageUrlsQueued.length >= MIN_IMAGES_QUEUED || isWaitingForImageUrls) {
      return;
    }

    console.debug('Loading a batch of new image URLs.');
    var batchId = ('00' + Math.floor(Math.random() * 1000)).slice(-3);
    $.ajax('imagenet/urls_' + batchId).
        done(handleImageUrlsLoad.bind(null, batchId)).
        fail(function() {
          console.error('Failed to load a batch of new image URLs. Retrying after 1s...');
          setTimeout(queueImagesIfNeeded, 1000);
        }).
        always(function() {
          isWaitingForImageUrls = false;
        });
    isWaitingForImageUrls = true;
  }


  function handleImageUrlsLoad(batchId, data) {
    console.debug('Loaded image URLs: ' + batchId);

    var lines = $.trim(data).split('\n');
    for (var i = 0; i < lines.length; ++i) {
      imageUrlsQueued.push(lines[i].split(/\s+/)[1]);
    }
    printStatus();

    cacheImagesIfNeeded();
  }


  function removeItem(a, item) {
    var i = a.indexOf(item);
    if (i >= 0) {
      a.splice(i, 1);  
    }
  }
});