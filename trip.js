// 行程的结构化配置：每天在哪个城市、住哪家酒店、地图坐标、主题色。
// 景点文字内容仍在 data.js；这里只放"逻辑用"的数据，app.js 不再写死任何日期判断。

const gmaps = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

const HOTELS = {
  madrid: {
    name: 'ibis budget Madrid Centro Lavapiés',
    stopName: 'ibis budget Madrid Centro Lavapiés',
    stayLabel: '我们的酒店 · ibis budget Madrid Centro Lavapiés',
    address: 'Calle de Valencia 8–10, 28012 Madrid',
    popupAddress: 'Calle de Valencia 8–10<br>28012 Madrid',
    tooltip: '<b>我们的酒店</b><br>ibis budget · Lavapiés',
    latlng: [40.40851, -3.700979],
    url: ''
  },
  bcn: {
    name: 'ibis Barcelona Centro (Sagrada Familia)',
    stopName: 'ibis Barcelona Centro (Sagrada Familia)',
    stayLabel: '巴塞罗那落脚点 · ibis Barcelona Centro (Sagrada Familia)',
    address: 'Carrer de Nàpols 230–232, 08013 Barcelona',
    popupAddress: 'Carrer de Nàpols 230–232<br>08013 Barcelona',
    tooltip: '<b>我们的酒店</b><br>ibis Barcelona Centro',
    latlng: [41.400735, 2.172466],
    url: 'https://www.google.com/maps/place/ibis+Barcelona+Centro/@41.4008321,2.1699658,17z/data=!3m1!4b1!4m9!3m8!1s0x12a4a2e829d193a1:0xaa3a86c9f3dd54cf!5m2!4m1!1i2!8m2!3d41.4008281!4d2.1725407!16s%2Fg%2F11b6g89xqs?entry=ttu&g_ep=EgoyMDI2MTExMC4wIKXMDSoASAFQAw%3D%3D'
  },
  lisbon: {
    name: 'VIP Executive Suites do Marquês Hotel',
    stopName: 'VIP Executive Suites do Marquês Hotel',
    stayLabel: '里斯本落脚点 · VIP Executive Suites do Marquês Hotel',
    address: 'Av. Duque de Loulé 45, 1050-086 Lisboa',
    popupAddress: 'Av. Duque de Loulé 45, 1050-086 Lisboa',
    tooltip: '<b>我们的酒店</b><br>VIP Executive Suites do Marquês',
    latlng: [38.727956, -9.144933],
    url: gmaps('VIP Executive Suites do Marquês Hotel, Av. Duque de Loulé 45, Lisboa, Portugal')
  },
  schiphol: {
    name: 'ibis Schiphol Amsterdam Airport',
    stopName: 'ibis Schiphol Amsterdam Airport',
    stayLabel: '阿姆斯特丹机场住宿 · ibis Schiphol Amsterdam Airport',
    address: 'Schipholweg 181, 1171 PK Badhoevedorp',
    popupAddress: 'Schipholweg 181, 1171 PK Badhoevedorp',
    tooltip: '<b>机场住宿</b><br>ibis Schiphol Amsterdam Airport',
    latlng: [52.32536, 4.79399],
    url: gmaps('ibis Schiphol Amsterdam Airport, Schipholweg 181, Badhoevedorp')
  }
};

// 天气按城市查询（Open-Meteo，免费、无需 key）。
const CITIES = {
  madrid:    { name: '马德里',   latlng: [40.4168, -3.7038] },
  toledo:    { name: '托莱多',   latlng: [39.8628, -4.0273] },
  barcelona: { name: '巴塞罗那', latlng: [41.3874, 2.1686] },
  lisbon:    { name: '里斯本',   latlng: [38.7223, -9.1393] },
  amsterdam: { name: '阿姆斯特丹', latlng: [52.3728, 4.8936] }
};

// 主题色：accent 用于标签、编号、地图标记；pin 是地图标记的底色。
const THEMES = {
  green:  { accent: '#246b60', pin: '#1c6859', soft: '#eaf1e8', line: '#abbcaf', ink: '#246b60' },
  orange: { accent: '#ae6a42', pin: '#b46e42', soft: '#f3e9df', line: '#cab39a', ink: '#925733' },
  blue:   { accent: '#526b91', pin: '#526b91', soft: '#e6edf5', line: '#aabbd1', ink: '#3c5579' },
  brown:  { accent: '#977445', pin: '#977445', soft: '#f3eadc', line: '#c8b697', ink: '#795d38' },
  rose:   { accent: '#a0526a', pin: '#a0526a', soft: '#f5e8ec', line: '#d3aab7', ink: '#7e3f53' }
};

// 每天一项，顺序与 data.js 的 days 一致。
//   coords    与 stops 一一对应；null = 没有地图位置（如"午餐"）。坐标与酒店重合的停留点不画标记。
//   offRoute  不参与虚线连线的停留点序号（机动备选）。
//   optional  用虚线圆圈标记的备选点序号。
//   routeStops 按给定序号画步行线，默认缩放到该段；「当天范围」仍显示全部标记。
//   mapSuffix / mapQuery  生成 Google Maps 链接：默认 "名称 + 后缀"，mapQuery 可按名称覆盖。
const TRIP = [
  {
    date: '2026-11-25', city: 'madrid', theme: 'green', short: '广场与艺术', tabCount: 5,
    hotel: 'madrid', hotelOnMap: true, mapSuffix: ', Madrid, Spain',
    mapQuery: { 'Puerta del Sol': '40.4169,-3.7035', 'Plaza de San Miguel': '40.4154,-3.7089', 'Plaza de España': '40.4234,-3.7122' },
    coords: [[40.4169, -3.7035], [40.4193, -3.6931], [40.4200, -3.6887], [40.4153, -3.6844], [40.4138, -3.6921]]
  },
  {
    date: '2026-11-26', city: 'madrid', theme: 'orange', short: '王宫与老城', tabCount: 7,
    hotel: 'madrid', hotelOnMap: true, mapSuffix: ', Madrid, Spain',
    mapQuery: { 'Puerta del Sol': '40.4169,-3.7035', 'Plaza de San Miguel': '40.4154,-3.7089', 'Plaza de España': '40.4234,-3.7122' },
    coords: [[40.4179, -3.7143], [40.4158, -3.7145], [40.4155, -3.7107], [40.4154, -3.7089], [40.4154, -3.7074], [40.4234, -3.7122], [40.424, -3.7178]]
  },
  {
    date: '2026-11-27', city: 'toledo', theme: 'blue', short: '托莱多', tabCount: 8, countText: '8 个地点 · 2 次休息',
    hotel: 'madrid', hotelOnMap: false, stayLabel: '马德里住宿 · ibis budget Madrid Centro Lavapiés（托莱多当天往返）',
    mapSuffix: ', Toledo, Spain',
    mapQuery: {
      'Estación de Autobuses de Toledo': '39.8654819,-4.0200955',
      'Puente de Alcántara': 'Puente de Alcantara Toledo',
      'Remonte mecánico de Safont': '39.861678,-4.0201236',
      'Museo del Ejército': 'Museo del Ejercito Toledo',
      'Biblioteca de Castilla-La Mancha': 'Biblioteca de Castilla La Mancha Toledo',
      'Catedral Primada': 'Catedral Primada Toledo',
      'Iglesia de Santo Tomé': 'Iglesia de Santo Tome Toledo',
      'Mirador del Valle': 'Mirador del Valle Toledo'
    },
    coords: [[39.8654819, -4.0200955], [39.860428, -4.0174076], [39.861678, -4.0201236], null, [39.8587739, -4.0205749], [39.8575568, -4.0208295], null, [39.8571004, -4.0235688], [39.8566992, -4.0283221], [39.8503616, -4.0218798]]
  },
  {
    date: '2026-11-28', city: 'barcelona', theme: 'brown', short: '巴塞罗那', tabCount: 10,
    hotel: 'bcn', hotelOnMap: true, mapSuffix: ', Barcelona, Spain',
    coords: [[41.3791, 2.1402], [41.400735, 2.172466], [41.387, 2.1701], [41.3876, 2.1753], [41.3842, 2.1754], [41.3839, 2.1762], [41.3831, 2.1763], [41.38, 2.1754], [41.3816, 2.1719], [41.3784, 2.1925]]
  },
  {
    date: '2026-11-29', city: 'barcelona', theme: 'brown', short: '建筑与全景', tabCount: 6, countText: '6 个地点 · 含机动备选',
    hotel: 'bcn', hotelOnMap: true, mapSuffix: ', Barcelona, Spain',
    offRoute: [5, 6], optional: [6],
    coords: [[41.4114, 2.1746], [41.4075, 2.1745], null, [41.4036, 2.1744], [41.4194, 2.1619], [41.4043, 2.1734], [41.4145, 2.1527]]
  },
  {
    date: '2026-11-30', city: 'barcelona', theme: 'brown', short: '巴萨与高迪', tabCount: 8,
    hotel: 'bcn', hotelOnMap: true, mapSuffix: ', Barcelona, Spain',
    coords: [[41.400735, 2.172466], [41.3797, 2.1204], null, [41.4035, 2.1506], null, [41.3954, 2.1620], [41.3916, 2.1649], null]
  },
  {
    date: '2026-12-01', city: 'lisbon', theme: 'rose', short: '里斯本与贝伦', tabCount: 8,
    hotel: 'lisbon', hotelOnMap: true, mapSuffix: ', Lisboa, Portugal',
    coords: [[38.7742, -9.1342], [38.727956, -9.144933], null, [38.69745, -9.20320], [38.69790, -9.20670], [38.69360, -9.20570], [38.69158, -9.21602], null]
  },
  {
    date: '2026-12-02', city: 'lisbon', theme: 'rose', short: '海岸与老城', tabCount: 12,
    hotel: 'lisbon', hotelOnMap: true, mapSuffix: ', Lisboa, Portugal',
    mapQuery: {
      'Cabo da Roca': 'Cabo da Roca, Colares, Portugal',
      'Azenhas do Mar': 'Azenhas do Mar, Colares, Portugal',
      'Estação de Portela de Sintra': 'Estação de Portela de Sintra, Sintra, Portugal',
      'Uma Marisqueira I': 'Uma Marisqueira I, Rua dos Sapateiros 177, Lisboa, Portugal',
      'Rossio — Praça Dom Pedro IV': 'Praça Dom Pedro IV, Lisboa, Portugal',
      'Praça do Comércio / Arco da Rua Augusta': 'Arco da Rua Augusta, Lisboa, Portugal'
    },
    coords: [[38.727956, -9.144933], [38.7804, -9.4989], [38.8405, -9.4622], [38.8025, -9.3756], [38.7138, -9.1394], [38.7139, -9.1335], [38.7117, -9.1301], [38.7098, -9.1333], [38.7087, -9.1367], [38.7108, -9.1377], [38.7121, -9.1394], [38.7129, -9.1388]]
  },
  {
    date: '2026-12-03', city: 'amsterdam', theme: 'blue', short: '里斯本与灯光节', tabCount: 10,
    hotel: 'schiphol', hotelOnMap: true, mapSuffix: ', Amsterdam, Netherlands',
    mapQuery: {
      'Aeroporto Humberto Delgado · LIS': 'Lisbon Airport Terminal 1, Lisbon, Portugal',
      'Schiphol Airport · AMS': 'Schiphol Plaza, Schiphol Airport, Netherlands',
      'Amsterdam Centraal → Schiphol Airport': 'Amsterdam Centraal, Amsterdam, Netherlands'
    },
    routeStops: [4, 5, 6, 7, 8, 4],
    coords: [null, null, [52.3097, 4.7634], HOTELS.schiphol.latlng, [52.3781, 4.9005],
      [52.37625, 4.9082], [52.3742, 4.9123], [52.3697, 4.9111], [52.37204, 4.90566], null]
  },
  {
    date: '2026-12-04', city: 'amsterdam', theme: 'blue', short: '运河、九街与花市', tabCount: 12,
    hotel: 'schiphol', hotelOnMap: true, mapSuffix: ', Amsterdam, Netherlands',
    stayLabel: '上午从 ibis Schiphol Amsterdam Airport 退房出发',
    mapQuery: {
      'Schiphol Airport · AMS': 'Schiphol Plaza, Schiphol Airport, Netherlands',
      'Damrak Waterfront': 'Damrak Waterfront, Amsterdam, Netherlands',
      'Oudezijds Voorburgwal · De Wallen': 'Oudezijds Voorburgwal at Damstraat, Amsterdam, Netherlands',
      'Reestraat · De 9 Straatjes': 'Reestraat, Amsterdam, Netherlands',
      'Rokin → Amsterdam Centraal': 'Rokin metro station, Amsterdam, Netherlands',
      'Amsterdam Centraal → Schiphol Airport': 'Amsterdam Centraal, Amsterdam, Netherlands'
    },
    routeStops: [2, 3, 4, 5, 6, 7, 8, 9],
    coords: [HOTELS.schiphol.latlng, [52.3097, 4.7634], [52.3781, 4.9005],
      [52.3762, 4.8988], [52.3745, 4.898], [52.3719, 4.8958], [52.3725, 4.8828],
      [52.369, 4.8877], [52.3667, 4.8919], [52.3691, 4.8926], null, null]
  }
];

// 某个停留点的 Google Maps 链接。
function mapsUrlFor(dayIndex, stop) {
  const t = TRIP[dayIndex], name = stop[2], hotel = HOTELS[t.hotel];
  if (hotel.url && name === hotel.stopName) return hotel.url;
  return gmaps((t.mapQuery && t.mapQuery[name]) || name + t.mapSuffix);
}
