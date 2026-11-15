import type { FarmLocation, Position } from "../types/wizard";

export interface MunicipalityOption { name: string; pcode: string; center: Position }
export interface DepartmentOption { name: string; pcode: string; municipalities: MunicipalityOption[] }
export interface CountryOption { name: string; code: string; departments: DepartmentOption[] }

// Dataset de demostración. Las claves PCODE están listas para reemplazarse por ADM1/ADM2/ADM3 GeoJSON.
export const COUNTRIES: CountryOption[] = [
  { name: "Bolivia", code: "BOL", departments: [
    { name: "La Paz", pcode: "BO-L", municipalities: [{ name: "Achocalla", pcode: "BO-L-0201", center: [-68.05, -16.57] }, { name: "Viacha", pcode: "BO-L-0208", center: [-68.29, -16.65] }, { name: "Palca", pcode: "BO-L-0206", center: [-67.96, -16.57] }, { name: "Mecapaca", pcode: "BO-L-0205", center: [-68.02, -16.67] }] },
    { name: "Cochabamba", pcode: "BO-C", municipalities: [{ name: "Cochabamba", pcode: "BO-C-0301", center: [-66.1568, -17.3895] }, { name: "Tiquipaya", pcode: "BO-C-0309", center: [-66.217, -17.338] }, { name: "Quillacollo", pcode: "BO-C-0308", center: [-66.280, -17.392] }] },
    { name: "Santa Cruz", pcode: "BO-S", municipalities: [{ name: "Santa Cruz de la Sierra", pcode: "BO-S-0701", center: [-63.1812, -17.7833] }, { name: "Montero", pcode: "BO-S-0705", center: [-63.255, -17.338] }] },
    ...[["Oruro", "BO-O", [-67.11, -17.97]], ["Potosí", "BO-P", [-65.75, -19.58]], ["Chuquisaca", "BO-H", [-65.26, -19.03]], ["Tarija", "BO-T", [-64.73, -21.53]], ["Beni", "BO-B", [-64.9, -14.83]], ["Pando", "BO-N", [-67.5, -11.03]]].map(([name, pcode, coords]) => ({ name: name as string, pcode: pcode as string, municipalities: [{ name: name as string, pcode: `${pcode}-0101`, center: coords as Position }] })),
  ] },
  { name: "Perú", code: "PER", departments: [{ name: "Puno", pcode: "PE-PUN", municipalities: [{ name: "Puno", pcode: "PE-PUN-2101", center: [-70.02, -15.84] }] }, { name: "Cusco", pcode: "PE-CUS", municipalities: [{ name: "Cusco", pcode: "PE-CUS-0801", center: [-71.97, -13.52] }] }] },
  { name: "Ecuador", code: "ECU", departments: [{ name: "Pichincha", pcode: "EC-P", municipalities: [{ name: "Quito", pcode: "EC-P-1701", center: [-78.47, -0.18] }] }] },
];

export const locationService = {
  async getCountries() { return COUNTRIES.map(({ name, code }) => ({ name, code })); },
  async getDepartments(countryCode: string) { return COUNTRIES.find((country) => country.code === countryCode)?.departments ?? []; },
  async getMunicipalities(countryCode: string, departmentCode: string) { return COUNTRIES.find((country) => country.code === countryCode)?.departments.find((department) => department.pcode === departmentCode)?.municipalities ?? []; },
  resolve(countryCode: string, departmentCode: string, municipalityCode: string): FarmLocation | null {
    const country = COUNTRIES.find((item) => item.code === countryCode);
    const department = country?.departments.find((item) => item.pcode === departmentCode);
    const municipality = department?.municipalities.find((item) => item.pcode === municipalityCode);
    if (!country || !department || !municipality) return null;
    return { country: country.name, countryCode, department: department.name, municipality: municipality.name, pcode: municipality.pcode, center: municipality.center };
  },
};
