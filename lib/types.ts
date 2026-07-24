export type Vendor = {
  id: string;
  login_id: string;
  company_code: string | null;
  company_name: string;
  biz_no: string | null;
  owner_name: string | null;
  email: string | null;
  real_ship_price: number;
  empty_box_price: number;
  biz_file_url: string | null;
};

export type Account = {
  id: string;
  kakao_id: string;
  store: string;
  buyer: string;
  receiver: string;
  user_id: string;
  phone: string;
  address: string;
  bank: string;
  account_no: string;
  holder: string;
};

export type GuideProduct = {
  id: string;
  active: boolean;
  code: string | null;
  company: string | null;
  platform: string | null;
  number_text: string | null;
  short_name: string;
  full_name: string | null;
  option_text: string | null;
  note: string | null;
  product_url: string | null;
  price: number | null;
  review_fee: string | null;
  payback_name: string | null;
  has_receipt: boolean;
  buy_type: string | null;
  review_type: string | null;
  delivery: string | null;
  image_url: string | null;
  deadline: string | null;
  checked_at: string | null;
};

export type OrderRow = {
  id: number;
  date_mmdd: string;
  company_code: string | null;
  company_name: string | null;
  platform: string | null;
  product_url: string | null;
  product_name: string;
  option_text: string;
  review_type: string | null;
  review_url: string | null;
  order_image: string | null;
  order_no: string | null;
  buyer: string | null;
  receiver: string | null;
  user_id: string | null;
  phone: string | null;
  address: string | null;
  account_text: string | null;
  amount: number | null;
  review_fee: number;
  review_done: boolean;
  paid: boolean;
  paid_date: string | null;
  delivery: string | null;
  tracking: string | null;
};

export type SlotOption = {
  value: string;
  label: string;
  amount: number | null;
  remaining: number;
};

export type SlotMap = Record<string, SlotOption[]>; // productName -> options
