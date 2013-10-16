---
layout: post
title:  "BlobFetch.js - preload large files"
categories:
    - javascript
    - utility
    - xhr
    - html5
    - video
---

Hacker News thread here: [https://news.ycombinator.com/item?id=6561451](https://news.ycombinator.com/item?id=6561451)

- - - - 

Some time ago i needed to be able to seek to any point in a `<video>`,
and i had to do this across 10-30 videos at the same time, all the time.
Streaming the videos from a remote server made most browsers 
buffer a few seconds forward, but not backwards, and loading them from
a server without streaming support allowed forward playback only; no seeking at all!

Seeking in the video without having to re-buffer from server was essential,
and so the quest for a solution began (okay, a very short 60 minute-ish quest, but a quest, nonetheless!).

BlobFetch.js
=============

And so i created BlobFetch.

BlobFetch is a tiny library for fetching (large) objects as blobs.
When downloaded, you can save with `LocalFileSystem` or use it directly
with `URL.createObjectURL`.

Some highlights are:

* progress callbacks (well, dah)
* abort download
* MIME type assertion <span style="font-size:0.8em;">(fire error instead of success callback if you expected `video/mp4` but got `application/json`)</span>


Example
----------------

Type any URL and press download.

Note that a correct `Access-Control-Allow-Origin` header is needed.

[imgur](imgur.com) sends correct headers, so head over there and find a large test image.

A few urls you could try:

* `http://i.imgur.com/RW5QXyX.jpg`
* `http://vjs.zencdn.net/v/oceans.mp4` ( from [videojs.com](http://www.videojs.com/) )
* `/assets/blobfetch.js/blobfetch.js`


<fieldset>
    <legend>Download</legend>
    <div>
        <label for="url">url: <input type="text" id="url" value=""></label>
        <button id="download">download!</button>
        <button id="clear">clear!</button>
    </div>
    <hr>
    <div id="progress">
        <div class="progress-bar"></div>
    </div>
    <hr>
    <div id="result">
    </div>
</fieldset>


Download
----------------
You can get the full source over at github:
[gist.github.com/tbug/6846380](https://gist.github.com/tbug/6846380)


Usage
-------------

### Simple usage
Here we download a video, create an object URL and set it as the source of a video element.

```javascript
var bf = BlobFetch('http://vjs.zencdn.net/v/oceans.mp4', function () {
    videoElement.src = window.URL.createObjectURL(this.response);
});
```

### Getting progress

```javascript
var bf = BlobFetch({
    url: 'http://vjs.zencdn.net/v/oceans.mp4',
    success: function () {
        myVideo.src = window.URL.createObjectURL(this.response);
    },
    progress: function () {
        //progress is a number between 0 and 1
        console.log((this.progress*100)+'% complete');
    }
});
```


### All of it

```javascript
var bf = BlobFetch({
    url: 'http://vjs.zencdn.net/v/oceans.mp4',
    //MIME check. Error called if download does not match
    expect: 'video/mp4',
    success: function () {
        myVideo.src = window.URL.createObjectURL(this.response);
    },
    error: function (err) {
        throw err;
    },
    progress: function () {
        console.log((this.progress*100)+'% complete');
    },
    abort: function () {
        console.warn("You aborted the download!!");
    }
});
```

- - - - 

You can check the source of this page for an actual usage example.




<script src="http://code.jquery.com/jquery-2.0.3.min.js"></script>
<script src="/assets/blobfetch.js/blobfetch.js"></script>
<script type="text/javascript">
    
$(function () {
    $progress = $('#progress');
    $bar = $('#progress .progress-bar');
    $button = $('#download');
    $clear = $('#clear');
    $input = $('#url');
    $result = $('#result');

    $progress.css({
        border: '0 solid transparent',
        borderRadius: 3,
        height: 20,
        background: '#ddd'
    });
    $bar.css({
        border: '0 solid transparent',
        borderRadius: 3,
        width: 0,
        height: 20,
        background: '#555'
    });
    $result.css({
        overflow: 'auto'
    });

    var handlers = [
        {
            type: /^video\//,
            handler: function (blob) {
                console.log("video detected");
                var $video = $('<video controls="controls"></video>');
                $video.css({
                    width: '100%'
                });
                $video.attr('src', URL.createObjectURL(blob));
                return $video;
            }
        },
        {
            type: /^image\//,
            handler: function (blob) {
                console.log("image detected");
                var $img = $('<img/>');
                $img.css({
                    width: '100%'
                });
                $img.attr('src', URL.createObjectURL(blob));
                return $img;
            }
        },
        {
            type: /^(text|application)\//,
            handler: function (blob) {
                console.log("text detected");
                var $pre = $('<pre></pre>');
                var $code = $('<code></code>');
                var reader = new FileReader();
                reader.addEventListener('loadend', function () {
                    $pre.text(reader.result);
                });
                reader.readAsText(blob);
                return $pre.append($code);
            }
        }
    ];

    $clear.click(function () {
        $result.empty();
        $bar.width(0);
    });

    $button.click(function () {

        var url = $input.val();
        if (url.length > 0) {
            $button.attr('disabled', 'disabled');
            $progress.width("100%");
            var fetcher = BlobFetch({
                url: url,
                success: function () {
                    var handler;
                    for (var i = 0; i < handlers.length; i++) {
                        if (fetcher.response.type.match(handlers[i].type)) {
                            handler = handlers[i].handler;
                            break;
                        }
                    };
                    if (!handler) {
                        $result.text("Don't know how to present "+fetcher.response.type);
                    }
                    else {
                        $result.width($result.parent().width());
                        $result.html(handler(fetcher.response));
                    }
                    $bar.width(fetcher.progress*100+'%');
                },
                progress: function () {
                    $bar.width(fetcher.progress*100+'%');
                },
                error: function (err) {
                    $button.removeAttr('disabled');
                },
                load: function () {
                    $button.removeAttr('disabled');
                }
            });
        }
        else {
            $result.text('Invalid URL');
        }
    });


});

</script>