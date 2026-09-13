export interface Book {
  id: string;
  code: string;
  title: string;
  author: string;
  publisher: string;
  categories: string[];
  quantity: number;
  cover_image_url: string | null;
}
