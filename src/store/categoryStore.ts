import { defineStore } from 'pinia';

export type CategoryType = 'cate2' | 'cate3'; // Or whatever types you use

interface CategoryState {
  currentCategoryType: CategoryType | null;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  // You might want to store available categories here as well
  // availableCategories: any[]; 
}

export const useCategoryStore = defineStore('category', {
  state: (): CategoryState => ({
    currentCategoryType: null,
    currentCategoryId: null,
    currentCategoryName: null,
    // availableCategories: [],
  }),
  getters: {
    isSelectedCategory: (state: CategoryState): boolean => {
      return !!state.currentCategoryId && !!state.currentCategoryType;
    },
    // Getter to return the full current category object if needed
    currentCategory: (state: CategoryState) => {
      if (state.currentCategoryId && state.currentCategoryType) {
        return {
          type: state.currentCategoryType,
          id: state.currentCategoryId,
          name: state.currentCategoryName || ''
        };
      }
      return null;
    }
  },
  actions: {
    setCurrentCategory(type: CategoryType, id: string, name: string) {
      this.currentCategoryType = type;
      this.currentCategoryId = id;
      this.currentCategoryName = name;
      console.log(`[categoryStore] Category set to Type: ${type}, ID: ${id}, Name: ${name}`);
      // Optionally, save to localStorage if you want to persist selection
      // localStorage.setItem('currentCategory', JSON.stringify({ type, id, name }));
    },
    clearCategory() {
      this.currentCategoryType = null;
      this.currentCategoryId = null;
      this.currentCategoryName = null;
      console.log('[categoryStore] Category cleared.');
      // localStorage.removeItem('currentCategory');
    },
    // Action to load category from localStorage (if you implement persistence)
    loadCategoryFromStorage() {
      const storedCategory = localStorage.getItem('currentCategory');
      if (storedCategory) {
        try {
          const cat = JSON.parse(storedCategory);
          if (cat && cat.type && cat.id) {
            this.setCurrentCategory(cat.type, cat.id, cat.name || '');
          }
        } catch (e) {
          console.error('Error parsing currentCategory from localStorage', e);
        }
      }
    }
  },
});

// Example of loading persisted category when store is initialized
// (Better done in main.ts or App.vue after Pinia is set up)
// const categoryStoreInstance = useCategoryStore();
// categoryStoreInstance.loadCategoryFromStorage(); 