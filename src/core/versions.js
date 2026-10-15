// Les deux versions proposées, et seulement celles-ci.
export const VERSIONS = {
  FRLSG: { id: 'FRLSG', short: 'LSG', label: 'Louis Segond 1910' },
  BDS: { id: 'BDS', short: 'BDS', label: 'Bible du Semeur 2015' },
};

export const VERSION_IDS = Object.keys(VERSIONS);

export function otherVersion(id) {
  return id === 'FRLSG' ? 'BDS' : 'FRLSG';
}
