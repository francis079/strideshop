<?php
header('Content-Type: application/json');

echo json_encode([
  'message' => 'StrideShop PHP API is running.',
  'products' => [
    ['name' => 'UltraLight Pro', 'price' => 89],
    ['name' => 'CityRun X', 'price' => 74],
    ['name' => 'TrailFlex', 'price' => 99],
  ],
], JSON_PRETTY_PRINT);
