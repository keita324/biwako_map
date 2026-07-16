[out:json][timeout:90][bbox:35.0020,135.8680,35.0125,135.8880];
(
  way["building"];
  way["highway"];
  way["natural"="coastline"];
  way["natural"="water"];
  relation["natural"="water"];
  way["leisure"];
  way["landuse"~"grass|recreation_ground|forest"];
  way["natural"~"wood|scrub|beach"];
  way["man_made"="pier"];
  way["amenity"="parking"];
);
out geom;
