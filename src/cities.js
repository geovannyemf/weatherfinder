import rawCities from '../resources/data/pokedensity-cities.json';

const cities = rawCities.map(({ lng, ...rest }, index) => ({
  ...rest,
  id: index + 1,
  lon: lng,
}));

export default cities;
