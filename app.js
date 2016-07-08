$(function() {
  var $workspace = $('.workspace');
  var $polaroid = $('.polaroid');

  var imagesCached = [];
  var imagesLoading = [];
  var imageUrlsQueued = [];
  var isWaitingForImage = false;
  var isWaitingForImageUrls = false;
  var imagesShown = 0;

  var isTouching = false;
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

  $workspace.on('touchstart mousedown', '.label', handleLabelTouchStart);
  $workspace.on('touchstart mousedown', '.polaroid', handleTouchStart);
  $workspace.on('touchmove mousemove', '.polaroid', handleTouchMove);
  $workspace.on('touchend mouseup', '.polaroid', handleTouchEnd);
  $(window).resize(resizePolaroid);

  resizePolaroid();
  setTimeout(function() { $polaroid.removeClass('hidden'); }, 300);
  textFit($('.instructions')[0]);


  function removeItem(a, item) {
    var i = a.indexOf(item);
    if (i >= 0) {
      a.splice(i, 1);  
    }
  }


  function showNextImage() {
    cacheImagesIfNeeded();
    if (imagesCached.length <= 0) {
      isWaitingForImage = true;
      console.warn('Ran out of cached images. Waiting for images to load...');
      return;
    }

    $polaroid = $('<div class="polaroid entering"></div>');
    var imgEl = imagesCached.pop();
    $polaroid.append(imgEl);
    $polaroid.append($('<div class="label">').text(imgEl.alt));
    $polaroid.appendTo($workspace);
    resizePolaroid($polaroid);

    setTimeout(function() { $polaroid.removeClass('entering'); }, 50);

    ++imagesShown;
    if (ga != null && (imagesShown < 5 || imagesShown % 5 == 0)) {
      ga('send', 'event', 'image', 'show', ('000' + imagesShown).slice(-4));
    }
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

      var imageData = imageUrlsQueued.pop();
      var imageName = imageData[0].replace(/_/g, ' ');
      var imageUrl = imageData[1];
      var imgEl = new Image();
      var timeout = setTimeout(handleImageTimeout.bind(null, imgEl), 5000);
      imgEl.onload = handleImageLoad.bind(null, imgEl, timeout);
      imgEl.onerror = handleImageError.bind(null, imgEl, timeout);
      imgEl.alt = imageName;
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
    } else if (/static.flickr.com/i.test(imgEl.src) &&
               imgEl.width == 500 && imgEl.height == 374) {
      console.warn('Rejected image for probably being a Flickr "no longer available" imgEl: ' + imgEl.src);
      return;
    } else if ((/.ggpht.com/i.test(imgEl.src) || /.blogspot.com/i.test(imgEl.src) ||
                /.google.com/i.test(imgEl.src)) &&
               imgEl.width == 200 && imgEl.height == 200) {
      console.warn('Rejected image for probably being a Google "no longer available" imgEl: ' + imgEl.src);
      return;
    }

    imagesCached.push(imgEl);

    // Show the next image if we were waiting on it.
    if (isWaitingForImage) {
      isWaitingForImage = false;
      showNextImage();
    }
  }


  function handleImageError(imgEl, timeout) {
    console.warn('Image errored out: ' + imgEl.src);
    removeItem(imagesLoading, imgEl);
  }


  function handleImageTimeout(imgEl) {
    console.warn('Image timed out: ' + imgEl.src);
    removeItem(imagesLoading, imgEl);
  }


  function queueImagesIfNeeded() {
    if (imageUrlsQueued.length >= MIN_IMAGES_QUEUED || isWaitingForImageUrls) {
      return;
    }

    console.debug('Loading a batch of new image URLs.');
    var batchId = Math.floor(Math.random() * 10000);
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
      imageUrlsQueued.push(lines[i].split(/\s+/).slice(1, 3));
    }

    cacheImagesIfNeeded();
  }


  function handleTouchStart(e) {
    var coordinates = e.changedTouches != null ? e.changedTouches[0] : e;
    touchStartX = coordinates.clientX;
    touchStartY = coordinates.clientY;
    touchX = 0;
    touchY = 0;
    touchT = new Date().valueOf();
    isTouching = true;
    
    $polaroid.addClass('touching');
    
    e.preventDefault();
  }


  function handleTouchMove(e) {
    if (!isTouching) {
      return;
    }

    var coordinates = e.changedTouches != null ? e.changedTouches[0] : e;
    lastTouchX = touchX;
    lastTouchY = touchY;
    lastTouchT = touchT;
    touchX = coordinates.clientX - touchStartX;
    touchY = coordinates.clientY - touchStartY;
    touchT = new Date().valueOf();
    
    $polaroid.css('transform', 'translate(' + touchX + 'px, ' + touchY + 'px) translate(-50%, -50%)');
    
    e.preventDefault();
  }


  function handleTouchEnd(e) {
    var deltaX = touchX - lastTouchX;
    var deltaY = touchY - lastTouchY;
    var deltaT = touchT - lastTouchT;
    isTouching = false;
    
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

    e.preventDefault();
  }


  function handleLabelTouchStart(e) {
    $(e.currentTarget).addClass('shown');
  }


  function resizePolaroid() {
    $polaroid.removeClass('width-bound height-bound');
    var imgEl = $polaroid.find('img')[0];
    var isWidthBound = imgEl.width / imgEl.height >= window.innerWidth / window.innerHeight;
    $polaroid.addClass(isWidthBound ? 'width-bound' : 'height-bound');
    textFit($polaroid.find('.label')[0]);
  }
});