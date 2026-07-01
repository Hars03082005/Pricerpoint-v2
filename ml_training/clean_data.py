"""
clean_data.py  –  PricerPoint Data Cleaning & Feature Engineering
=====================================================================
Reads  : ml_training/data/cars.csv
Writes : ml_training/data/cleaned.csv
         ml_training/data/brand_stats.csv
"""

import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

CURRENT_YEAR = 2026

# -- Brand tier mapping (covers all 46 OEMs in dataset) -------
BRAND_TIER = {
    # Budget
    'maruti':              'Budget',
    'datsun':              'Budget',
    'bajaj':               'Budget',
    'chevrolet':           'Budget',
    'fiat':                'Budget',
    'opel':                'Budget',
    'premier':             'Budget',
    'hindustan motors':    'Budget',
    'icml':                'Budget',
    'force':               'Budget',
    'ashok leyland':       'Budget',
    # Mid
    'hyundai':             'Mid',
    'honda':               'Mid',
    'tata':                'Mid',
    'renault':             'Mid',
    'nissan':              'Mid',
    'ford':                'Mid',
    'mahindra':            'Mid',
    'mahindra renault':    'Mid',
    'mahindra ssangyong':  'Mid',
    'mitsubishi':          'Mid',
    'isuzu':               'Mid',
    'citroen':             'Mid',
    'dc':                  'Mid',
    # Premium
    'volkswagen':          'Premium',
    'skoda':               'Premium',
    'toyota':              'Premium',
    'mg':                  'Premium',
    'jeep':                'Premium',
    'kia':                 'Premium',
    'mini':                'Premium',
    'volvo':               'Premium',
    'lexus':               'Premium',
    # Luxury
    'bmw':                 'Luxury',
    'mercedes-benz':       'Luxury',
    'audi':                'Luxury',
    'jaguar':              'Luxury',
    'land rover':          'Luxury',
    'porsche':             'Luxury',
    'maserati':            'Luxury',
    'aston martin':        'Luxury',
    'bentley':             'Luxury',
    'rolls-royce':         'Luxury',
    'ferrari':             'Luxury',
    'lamborghini':         'Luxury',
    'hummer':              'Luxury',
}

OWNER_MAP = {
    'first':            1,
    'second':           2,
    'third':            3,
    'fourth':           4,
    'fifth':            5,
    'unregistered car': 1,
}


def clean_cars(filepath: str = 'data/cars.csv') -> pd.DataFrame:
    """
    Cleans and feature-engineers the cars.csv dataset.
    Uses ALL available columns for maximum model signal.
    """
    print(f"Loading {filepath} ...")
    df = pd.read_csv(filepath)
    raw_len = len(df)
    print(f"  Raw rows : {raw_len:,}")

    # -- Derive year from car_age ------------------------------
    df['year'] = CURRENT_YEAR - df['car_age']

    # -- Standardise string columns ----------------------------
    str_cols = ['oem', 'model', 'variant', 'body', 'fuel',
                'transmission', 'owner_type', 'Color',
                'Engine Type', 'Gear Box', 'Drive Type',
                'City', 'state']
    for c in str_cols:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip().str.lower()

    # -- Owner number ------------------------------------------
    df['owner_num'] = df['owner_type'].map(OWNER_MAP).fillna(2).astype(int)

    # -- Brand tier --------------------------------------------
    df['brand_tier'] = df['oem'].map(BRAND_TIER).fillna('Mid')

    # -- Booleans to int ---------------------------------------
    for c in ['Turbo Charger', 'Super Charger']:
        if c in df.columns:
            df[c] = df[c].astype(bool).astype(int)

    # -- Price (target) ----------------------------------------
    df = df.rename(columns={'listed_price': 'price_inr'})

    # -- Remove price outliers ---------------------------------
    df = df[df['price_inr'] > 50_000]
    df = df[df['price_inr'] < 500_000_000]   # 50 Cr cap
    df = df[df['km'] > 100]
    df = df[df['km'] < 500_000]
    df = df[df['car_age'] >= 0]
    df = df[df['car_age'] <= 30]

    # -- Drop nulls on critical columns ------------------------
    df = df.dropna(subset=['price_inr', 'km', 'fuel', 'transmission'])

    # -- Drop duplicates ---------------------------------------
    df = df.drop_duplicates()
    df = df.reset_index(drop=True)

    # -- Derived features --------------------------------------
    df['age_km']          = df['car_age'] * df['km']
    df['is_low_mileage']  = (df['km_per_year'] < 5000).astype(int)
    df['volume_cc']       = df['Length'] * df['Width'] * df['Height']  # proxy for cabin volume
    df['is_turbo']        = df['Turbo Charger']
    df['is_supercharged'] = df['Super Charger']

    print(f"  Clean rows: {len(df):,}  (removed {raw_len - len(df):,})")
    print(f"  Brands    : {df['oem'].nunique()}")
    print(f"  Features  : {list(df.columns)}")
    return df


def get_brand_stats(df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns per-brand depreciation and inventory stats.
    Depreciation rate = (max_avg_price - avg_price_by_age) / max_avg_price
    """
    stats = []
    for brand, grp in df.groupby('oem'):
        age_price = grp.groupby('car_age')['price_inr'].mean()
        if len(age_price) < 2:
            continue
        max_p = age_price.max()
        dep_rate = ((max_p - age_price.iloc[-1]) / max_p * 100
                    if max_p > 0 else 0)
        stats.append({
            'brand':        brand,
            'count':        len(grp),
            'avg_price':    round(grp['price_inr'].mean(), 0),
            'min_price':    round(grp['price_inr'].min(), 0),
            'max_price':    round(grp['price_inr'].max(), 0),
            'dep_rate_pct': round(dep_rate, 1),
            'brand_tier':   grp['brand_tier'].iloc[0],
        })
    return pd.DataFrame(stats).sort_values('count', ascending=False)


if __name__ == '__main__':
    from pathlib import Path

    # Resolve data/ relative to this script regardless of CWD
    script_dir = Path(__file__).resolve().parent
    data_dir   = script_dir / 'data'

    df = clean_cars(str(data_dir / 'cars.csv'))
    df.to_csv(data_dir / 'cleaned.csv', index=False)
    print('\nSaved -> data/cleaned.csv')

    brand_stats = get_brand_stats(df)
    brand_stats.to_csv(data_dir / 'brand_stats.csv', index=False)
    print('Saved -> data/brand_stats.csv')

    print('\n-- Price Summary --')
    print(df['price_inr'].describe().apply(lambda x: f'Rs.{x:,.0f}'))
    print('\n-- Brand Tier Counts --')
    print(df['brand_tier'].value_counts())
