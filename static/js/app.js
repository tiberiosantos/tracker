function getFile(el, title) {
  var link = null,
    proxy = document.createElement('a');
    date_prefix = new Date().toLocaleString().match(/\d+/g).join('');

  fetch(el.dataset.href, {
    headers: new Headers({
      'Origin': location.origin
    }),
    cors: true
  }).then(function(response) {
    return response.blob()
  }).then(function(blob) {
    if (link) URL.revokeObjectURL(link);
    link = URL.createObjectURL(blob);
    proxy.href = link;
    proxy.download = `${title}_${date_prefix}.csv`;
    proxy.click();
  })
}

(function() {
  var dataset = document.getElementById('download').dataset.href,
    map = L.map('map'),
    style = {
      'color': '#8395a7',
      'weight': 5,
      'opacity': 0.65
    }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    'tileSize': 512,
    'zoomOffset': -1,
    'maxZoom': 16
  }).addTo(map);
  fetch('static/js/city.geojson')
    .then(function(response) {
      return response.json()
    })
    .then(function(data) {
      var geojson = L.geoJSON(data, {'style': style}).addTo(map);
      map.fitBounds(geojson.getBounds());
    })

  Papa.parse(dataset, {
    downloadRequestHeaders: {
      'Origin': location.origin
    },
    download: true,
    header: true,
    step: function(row) {
      var data = row.data,
        coord = data.GEOCODE.replace(/(^geo:|\?.*$)/g, '').split(',').map(Number),
        numMarker = L.ExtraMarkers.icon({
          'icon': 'fa-number',
          'number': data.CONFIRMADOS,
          'markerColor': 'orange'
        }),
        items = ['suspects', 'confirmations', 'recoveries', 'fatalities'],
        headers = ['SUSPEITOS', 'CONFIRMADOS', 'RECUPERADOS', 'FATALIDADES'];

      items.forEach(function(e) {
        var sel = document.getElementById(e);
        sel.textContent = (Number(sel.textContent) || 0) + Number(data[headers[items.indexOf(e)]]);
      });

      L.marker(coord, {icon: numMarker}).addTo(map)
        .bindPopup(`<p class="caption">${data.UNIDADE}</p>
        <p class="blue">
          <i class="fas fa-microscope"></i>&nbsp;&nbsp;<strong>${data.SUSPEITOS}</strong> Casos Suspeitos
        </p>
        <p class="orange">
          <i class="fas fa-virus"></i>&nbsp;&nbsp;<strong>${data.CONFIRMADOS}</strong> Casos Confirmados
        </p>
        <p class="green">
          <i class="fas fa-heart"></i>&nbsp;&nbsp;<strong>${data.RECUPERADOS}</strong> Casos Recuperados 
        </p>
        <p class="red">
          <i class="fas fa-cross"></i> &nbsp;&nbsp;<strong>${data.FATALIDADES}</strong> Casos Fatais
        </p>`)
        .on('click', function(e) {
          map.flyTo(coord, 18);
          this.openPopup();
        })
        .on('mouseover', function(e) {
          this.openPopup();
        });
    }
  });
})()

