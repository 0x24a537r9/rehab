$(function() {
  var $workspace = $('.workspace');
  var $polaroid = null;

  var imagesCached = [];
  var imagesLoading = [];
  var imageUrlsQueued = [];
  var isWaitingForImage = false;
  var isWaitingForImageUrls = false;

  var touchStartX = 0;
  var touchStartY = 0;
  var lastTouchX = 0;
  var lastTouchY = 0;
  var lastTouchT = 0;
  var touchX = 0;
  var touchY = 0;
  var touchT = 0;

  var MIN_IMAGES_CACHED_OR_LOADING = 10;
  var MAX_IMAGES_LOADING = 10;
  var MIN_IMAGES_QUEUED = 10;

  $workspace.on('touchstart', '.polaroid', handleTouchStart);
  $workspace.on('touchmove', '.polaroid', handleTouchMove);
  $workspace.on('touchend', '.polaroid', handleTouchEnd);
  $(window).resize(resizePolaroid);

  showNextImage();


  function printStatus() {
    console.debug('Cached: ' + imagesCached.length + ', ' +
                  'Loading: ' + imagesLoading.length + ', ' +
                  'Queued: ' + imageUrlsQueued.length);
  }


  function removeItem(a, item) {
    var i = a.indexOf(item);
    if (i >= 0) {
      a.splice(i, 1);  
    }
  }


  function showNextImage() {
    printStatus();
    cacheImagesIfNeeded();
    if (imagesCached.length <= 0) {
      isWaitingForImage = true;
      console.warn('Ran out of cached images. Waiting for images to load...');
      return;
    }

    $polaroid = $('<div class="polaroid entering"></div>');
    $polaroid.append(imagesCached.pop());
    resizePolaroid($polaroid);
    $polaroid.appendTo($workspace);

    setTimeout(function() { $polaroid.removeClass('entering'); }, 50);
  }


  function cacheImagesIfNeeded() {
    if (imagesCached.length + imagesLoading.length >= MIN_IMAGES_CACHED_OR_LOADING) {
      return;
    }

    console.debug('Loading a batch of new images.');
    while (imagesLoading.length < MAX_IMAGES_LOADING) {
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
      imagesLoading.push(imgEl);
      console.debug('Loading image: ' + imageUrl);
    }
  }


  function handleImageLoad(imgEl, timeout) {
    console.debug('Loaded image: ' + imgEl.src);

    // Add to imagesCached.
    clearTimeout(timeout);
    removeItem(imagesLoading, imgEl);
    if (imgEl.width < 100 || imgEl.height < 100) {
      console.warn('Rejected image for being too small: ' + imgEl.src);
      return;
    } else if (/static.flickr.com/i.test(imgEl.src) && imgEl.width == 500 && imgEl.height == 374) {
      console.warn('Rejected image for probably being a Flickr "no longer available" imgEl: ' + imgEl.src);
      return;
    } else if (/.ggpht.com/i.test(imgEl.src) && imgEl.width == 200 && imgEl.height == 200) {
      console.warn('Rejected image for probably being a Google "no longer available" imgEl: ' + imgEl.src);
      return;
    }

    imagesCached.push(imgEl);
    printStatus();

    // Show the next image if we were waiting on it.
    if (isWaitingForImage) {
      isWaitingForImage = false;
      showNextImage();
    }
  }


  function handleImageError(imgEl, timeout) {
    console.warn('Image errored out: ' + imgEl.src);
    removeItem(imagesLoading, imgEl);
    printStatus();
  }


  function handleImageTimeout(imgEl) {
    console.warn('Image timed out: ' + imgEl.src);
    removeItem(imagesLoading, imgEl);
    printStatus();
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


  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
    touchX = 0;
    touchY = 0;
    touchT = new Date().valueOf();
    $polaroid.addClass('touching');
  }


  function handleTouchMove(e) {
    lastTouchX = touchX;
    lastTouchY = touchY;
    lastTouchT = touchT;
    touchX = e.changedTouches[0].clientX - touchStartX;
    touchY = e.changedTouches[0].clientY - touchStartY;
    touchT = new Date().valueOf();
    $polaroid.css('transform', 'translate(' + touchX + 'px, ' + touchY + 'px) translate(-50%, -50%)');
  }


  function handleTouchEnd(e) {
    var deltaX = touchX - lastTouchX;
    var deltaY = touchY - lastTouchY;
    var deltaT = touchT - lastTouchT;
    
    $polaroid.removeClass('touching');
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaT > 0.25) {
      // Dismiss the image.
      var $oldPolaroid = $polaroid;
      $oldPolaroid.addClass('dismissing');
      touchX += deltaX * 600 / deltaT;
      touchY += deltaY * 600 / deltaT;
      $oldPolaroid.css('transform', 'translate(' + touchX + 'px, ' + touchY + 'px) translate(-50%, -50%)');
      setTimeout(function() { $oldPolaroid.remove(); }, 600);

      showNextImage();
    } else {
      // Snap the image back to the center.
      $polaroid.css('transform', 'translate(-50%, -50%)');  
    }
  }


  function resizePolaroid() {
    $polaroid.removeClass('width-bound height-bound');
    var imgEl = $polaroid.find('img')[0];
    var isWidthBound = imgEl.width / imgEl.height >= window.innerWidth / window.innerHeight;
    $polaroid.addClass(isWidthBound ? 'width-bound' : 'height-bound');
  }
});