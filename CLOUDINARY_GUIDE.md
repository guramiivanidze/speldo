# Cloudinary Setup Guide

This guide explains how to set up Cloudinary for image storage in the Splendor Online project.

## What is Cloudinary?

Cloudinary is a cloud-based image and video management service that provides:
- Image storage and delivery via CDN
- Automatic image optimization and transformation
- Easy integration with Django through django-cloudinary-storage

## Step 1: Create a Cloudinary Account

1. Go to [https://cloudinary.com/](https://cloudinary.com/)
2. Click **Sign Up Free**
3. Complete the registration process
4. Verify your email address

## Step 2: Get Your Cloudinary Credentials

1. Log in to your Cloudinary Dashboard
2. On the Dashboard home page, you'll see your **Account Details**:
   - **Cloud Name**: Your unique cloud identifier (e.g., `dxyz123abc`)
   - **API Key**: Your public API key (numeric)
   - **API Secret**: Your private API secret (click "Reveal" to see it)

> ⚠️ **Important**: Never commit your API Secret to version control!

## Step 3: Configure Environment Variables

### Local Development

Create a `.env` file in the `backend/` directory (you can copy from `.env.example`):

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Production (Render.com)

1. Go to your Render dashboard
2. Select your backend service
3. Navigate to **Environment** tab
4. Add the following environment variables:

| Variable | Value |
|----------|-------|
| `CLOUDINARY_CLOUD_NAME` | Your cloud name from Cloudinary |
| `CLOUDINARY_API_KEY` | Your API key from Cloudinary |
| `CLOUDINARY_API_SECRET` | Your API secret from Cloudinary |

5. Click **Save Changes** - the service will automatically redeploy

## Step 4: Install Dependencies

The dependencies are already in `requirements.txt`, but if you need to install them manually:

```bash
cd backend
pip install cloudinary django-cloudinary-storage
```

## Step 5: Verify the Setup

### Check Settings

The following has already been configured in `splendor/settings.py`:

```python
INSTALLED_APPS = [
    # ... other apps
    'cloudinary_storage',  # Must be before 'django.contrib.staticfiles'
    'django.contrib.staticfiles',
    'cloudinary',
    # ... other apps
]

# Cloudinary Configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
    'API_KEY': os.environ.get('CLOUDINARY_API_KEY', ''),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET', ''),
}

# Use Cloudinary for media storage when configured
if os.environ.get('CLOUDINARY_CLOUD_NAME'):
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

### Test Image Upload

1. Start the Django development server:
   ```bash
   python manage.py runserver
   ```

2. Go to the Django admin: `http://localhost:8000/admin/`

3. Navigate to **Game > Development Cards** or **Game > Nobles**

4. Edit a card/noble and upload an image

5. Save the record

6. Check your Cloudinary Media Library - the image should appear there!

## How It Works

### Image URLs

When Cloudinary is configured:
- Images uploaded through Django admin are stored in Cloudinary
- The `background_image` field stores the full Cloudinary URL (e.g., `https://res.cloudinary.com/your-cloud/image/upload/v1234/cards/example.jpg`)
- The frontend detects absolute URLs and uses them directly

When Cloudinary is NOT configured (local development):
- Images are stored locally in the `media/` directory
- The `background_image` field stores a relative path (e.g., `/media/cards/example.jpg`)
- The frontend prepends the API base URL

### Existing Images

If you have existing images stored locally and want to migrate them to Cloudinary:

1. Set up Cloudinary credentials
2. Re-upload images through the Django admin, or
3. Use the Cloudinary CLI/API to bulk upload existing images

## Troubleshooting

### Images not uploading

1. Check that all three environment variables are set:
   ```bash
   python -c "import os; print('CLOUDINARY_CLOUD_NAME:', bool(os.environ.get('CLOUDINARY_CLOUD_NAME')))"
   ```

2. Verify credentials in Cloudinary dashboard

3. Check Django logs for error messages

### Images showing as broken

1. Ensure the image URL is accessible (open it in a browser)
2. Check CORS settings if images fail to load from frontend
3. Verify the image was uploaded successfully in Cloudinary Media Library

### Local vs Production

- **Local (no Cloudinary)**: Uses local file storage (`media/` directory)
- **Production (with Cloudinary)**: Uses Cloudinary CDN

This allows you to develop locally without needing Cloudinary credentials.

## Cloudinary Dashboard Tips

### Media Library
- View all uploaded images at: `https://console.cloudinary.com/console/<your-cloud>/media_library`
- Organize images into folders
- Search and filter uploads

### Transformations
Cloudinary supports URL-based transformations. For example:
- Resize: `https://res.cloudinary.com/your-cloud/image/upload/w_200,h_200/image.jpg`
- Crop: `https://res.cloudinary.com/your-cloud/image/upload/c_fill,w_200,h_200/image.jpg`
- Format: `https://res.cloudinary.com/your-cloud/image/upload/f_auto/image.jpg`

### Usage & Limits
- Free tier includes 25GB storage and 25GB bandwidth/month
- Monitor usage at: Dashboard > Usage

## Additional Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [django-cloudinary-storage Documentation](https://github.com/klis87/django-cloudinary-storage)
- [Cloudinary Django SDK](https://cloudinary.com/documentation/django_integration)
