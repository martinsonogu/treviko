import snapshot from './fdc-fixture.json';
import { normalizeFdcRecord } from './usda';
import { recipeSchema,type Recipe } from './schema';
// Four actual USDA snapshots, captured by scripts/fetch-fdc-fixture.py. Not live data.
export const fixtureFoods=snapshot.map(record=>normalizeFdcRecord(record,true,record.retrievedAt));
const bowl=(id:string,name:string,cuisine:string,bean:string):Recipe=>recipeSchema.parse({id,name,cuisine,dietaryPatterns:['vegan','vegetarian','omnivore','pescatarian'],servings:1,preparationMinutes:15,instructions:['Use the specified cooked, unsalted ingredients.','Heat the cooked pulses and rice thoroughly, then combine. Season to your preference; additions are not included in the nutrition calculation.'],ingredients:[{foodId:'fdc-168878',grams:150},{foodId:bean,grams:180}],allergens:[],allergenStatus:'unknown',developmentFixture:true});
export const fixtureRecipes=[
 bowl('african-inspired-cowpea-bowl','Cowpea and rice bowl','African-inspired','fdc-173759'),
 bowl('indian-inspired-lentil-bowl','Lentil and rice bowl','Indian-inspired','fdc-172421'),
 bowl('middle-eastern-inspired-lentil-bowl','Lentil rice plate','Middle Eastern-inspired','fdc-172421'),
 bowl('latin-american-inspired-bean-bowl','Black bean and rice bowl','Latin American-inspired','fdc-173735'),
 bowl('mediterranean-inspired-cowpea-bowl','Cowpea rice plate','Mediterranean-inspired','fdc-173759'),
];
// These are authored, minimal demonstration recipes, not verified traditional recipes.
// Allergen status stays unknown until ingredient labels/sourcing are reviewed.
