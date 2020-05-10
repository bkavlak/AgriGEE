var Sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR"),
    MODIS_LST = ee.ImageCollection("MODIS/006/MOD11A1"),
    roi = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[39.00702880613326, 38.79581363277971],
          [39.00702880613326, 38.67315658320406],
          [39.24186156980514, 38.67315658320406],
          [39.24186156980514, 38.79581363277971]]], null, false);

// NDVI, TCI, VCI, VHI Functions
// NDVI
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
};
// TCI
var tciFunc = function(min,max) {
  var wrap = function(img) {
    var index = img.expression(
    '(max-LST)/(max-min)'
    ,{
      'LST': img,
      'min': min,
      'max': max,
      }).rename('TCI')
      .copyProperties(img,['system:time_start','system:time_end']);
  return index;
  };
  return wrap;
};
// VCI
var vciFunc = function(min,max) {
  var wrap = function(img) {
    var index = img.expression(
    '(NDVI-min)/(max-min)'
    ,{
      'NDVI': img,
      'min': min,
      'max': max,
      }).rename('VCI')
      .copyProperties(img,['system:time_start','system:time_end']);
  return index;
  };
  return wrap;
};

// DEFINE TIME
var start_time = ee.Date('2017-09-01');
var end_time   = ee.Date('2018-09-30');

var focal_time = ee.Date('2018-09-20').getRange('day');
var focal_time_start = ee.Date('2018-09-15');
var focal_time_end   = ee.Date('2018-09-25');

// PREPARE IMAGES
// Modis Land Surface Temperature
var LST_Collection = MODIS_LST
                    .filter(ee.Filter.date(start_time, end_time))
                    .select('LST_Day_1km');

// Sentinel-2 NDVI
var NDVIs2_Collection = Sentinel2.map(addNDVI)
                            .filterBounds(roi)
                            .filterDate(start_time, end_time)
                            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
                            .select('NDVI');

var RGBs2 = Sentinel2.map(addNDVI)
              .filterBounds(roi)
              .filterDate(focal_time_start, focal_time_end)
              .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
              .select('B4', 'B3', 'B2', 'NDVI')
              .mosaic();

// Modis NDVI
var NDVImod_Collection = ee.ImageCollection("MODIS/MOD09GA_006_NDVI")
                    .filter(ee.Filter.date('2008-09-01', '2018-09-30'))
                    .select('NDVI');

// INDEX CALCULATIONS
// Minimum and Maximum Images

var minLST = LST_Collection.reduce(ee.Reducer.min());
var maxLST = LST_Collection.reduce(ee.Reducer.max());

var minNDVI = NDVIs2_Collection.reduce(ee.Reducer.min());
var maxNDVI = NDVIs2_Collection.reduce(ee.Reducer.max());

// Calculate TCI Collection
var TCI_Collection = LST_Collection.map(tciFunc(minLST, maxLST));

// Calculate VCI Collection
var VCI_Collection = NDVIs2_Collection.map(vciFunc(minNDVI, maxNDVI));

// Check Dates of VCI
print(VCI_Collection);

// Subset the Focal Date
var TCI_t1 = TCI_Collection
             .filter(ee.Filter.date(focal_time))
             .sum()
             .clip(roi);
var VCI_t1 = VCI_Collection
            .filter(ee.Filter.date(focal_time_start, focal_time_end))
            .mean()
            .clip(roi);

// Calculate VHI
var VHI_t1 = TCI_t1.add(VCI_t1).divide(ee.Number(2)).rename('VHI');

// VISUALIZATIONS
// Visualization Parameters
var LSTVis = {
  min: 13000.0,
  max: 16500.0,
  palette: [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ],
};

var TCIVis = {
  min: 0,
  max: 1,
  palette: [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ],
};

var VHIVis = {
  min: 0,
  max: 1,
  palette: ['306466', '9cab68', 'cccc66', '9c8448', '6e462c'],
};

var RGBVis = {
    
    bands : ['B4', 'B3', 'B2'],
    min : [0, 0, 0],
    max : [2200, 2200, 2200],
    
    };

// Adding Layers to the Map
Map.addLayer(
    RGBs2.clip(roi),
    RGBVis,
    'RGB');

Map.addLayer(
    RGBs2.select('NDVI').clip(roi),
    VHIVis,
    'NDVI');

Map.addLayer(
    VHI_t1/*.focal_mean(50, 'circle', 'meters')*/,
    VHIVis,
    'Vegetation Health Index');
