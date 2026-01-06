from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Favorite
from ..schemas import FavoriteCreate, FavoriteUpdate, FavoriteResponse

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/{wallet_address}", response_model=List[FavoriteResponse])
def get_favorites(wallet_address: str, db: Session = Depends(get_db)):
    favorites = db.query(Favorite).filter(
        Favorite.wallet_address == wallet_address
    ).all()
    return favorites


@router.post("/", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def create_favorite(favorite: FavoriteCreate, db: Session = Depends(get_db)):
    existing = db.query(Favorite).filter(
        Favorite.wallet_address == favorite.wallet_address,
        Favorite.alias == favorite.alias
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alias '{favorite.alias}' already exists for this wallet"
        )
    
    db_favorite = Favorite(**favorite.model_dump())
    db.add(db_favorite)
    db.commit()
    db.refresh(db_favorite)
    return db_favorite


@router.put("/{favorite_id}", response_model=FavoriteResponse)
def update_favorite(
    favorite_id: int,
    favorite_update: FavoriteUpdate,
    db: Session = Depends(get_db)
):
    db_favorite = db.query(Favorite).filter(Favorite.id == favorite_id).first()
    
    if not db_favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found"
        )

    update_data = favorite_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_favorite, field, value)
    
    db.commit()
    db.refresh(db_favorite)
    return db_favorite


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_favorite(favorite_id: int, db: Session = Depends(get_db)):
    db_favorite = db.query(Favorite).filter(Favorite.id == favorite_id).first()
    
    if not db_favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found"
        )
    
    db.delete(db_favorite)
    db.commit()
    return None


