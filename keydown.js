var keyword = '';
function append(key) {
	keyword = keyword + key;
	console.log(keyword);
}

function send() {
    
    // XMLHttpRequest オブジェクトの作成
    var xhr = new XMLHttpRequest();

    // 送信するデータ
    var params = "key=" + keyword;

    // 送信先 URL と HTTP メソッドを指定
    xhr.open('GET', 'xxxx' + params, true);

    // サーバーからの応答が正常に戻った場合の処理を設定
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
      } else {
        // エラー処理をここに書く
        console.error("Request failed with status: " + xhr.status);
      }
    };

    // エラー発生時の処理を設定
    xhr.onerror = function () {
      console.error("Request failed");
    };

    // データの送信
    xhr.send();
}


document.addEventListener('keydown', (event) => {
    console.log(event.key);
    if (event.key == 'Enter') {
     send();    	
    } else {
    	append(event.key);
    }
});
