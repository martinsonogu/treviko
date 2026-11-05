"""Refresh a small, traceable development fixture using USDA's published DEMO_KEY.
No private API key is read. Run deliberately; the public demo key has low quotas.
"""
import json, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path
source_ids=[168878,172421,173735,173759]
rows=[]
for fdc_id in source_ids:
 with urllib.request.urlopen(f'https://api.nal.usda.gov/fdc/v1/food/{fdc_id}?api_key=DEMO_KEY',timeout=15) as response: food=json.load(response)
 if food['fdcId']!=fdc_id or food['dataType']!='SR Legacy': raise RuntimeError('Unexpected source record')
 rows.append({'fdcId':food['fdcId'],'description':food['description'],'dataType':food['dataType'],'foodNutrients':[n for n in food['foodNutrients'] if n['nutrient']['id'] in [1008,1003,1004,1005]],'sourceUrl':f'https://fdc.nal.usda.gov/food-details/{fdc_id}/nutrients','retrievedAt':datetime.now(timezone.utc).isoformat()})
Path('src/lib/nutrition/fdc-fixture.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps([{'fdcId':f['fdcId'],'description':f['description']} for f in rows]))
