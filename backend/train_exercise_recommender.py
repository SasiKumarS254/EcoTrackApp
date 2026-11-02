"""
EcoTrack Animal Training Exercise Recommender
Real ML Pipeline - AKC APDT BHS FEI IAABC AARV PDSA Wikipedia
"""
import os, sys, json, time, argparse, sqlite3, pickle
from pathlib import Path
from datetime import datetime

REQUIRED = {"numpy": "numpy", "sklearn": "scikit-learn", "requests": "requests"}
missing = [pkg for mod, pkg in REQUIRED.items() if not __import__("importlib").util.find_spec(mod)]
if missing:
    print(f"Install: pip install {chr(32).join(missing)}")
    sys.exit(1)

import numpy as np
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.linear_model import Ridge
from sklearn.model_selection import cross_val_score

BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models" / "exercise_recommender"
DATA_DIR   = BASE_DIR / "datasets" / "exercise_training"
DB_PATH    = BASE_DIR / "ecotrack_scans.db"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

EXERCISE_DATA_PATH = DATA_DIR / "exercises_verified.json"
MODEL_PATH         = MODELS_DIR / "recommender.pkl"
VECTORIZER_PATH    = MODELS_DIR / "tfidf_vectorizer.pkl"
META_PATH          = MODELS_DIR / "model_meta.json"
