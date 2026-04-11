from azure.storage.blob import BlobServiceClient, StorageStreamDownloader
def read_blob(connection_string,container_name,blob_name) :

    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    blob_client = blob_service_client.get_blob_client(
        container=container_name,
        blob=blob_name
    )

    if not blob_client.exists():
        raise FileNotFoundError(f"Blob not found: {container_name}/{blob_name}")

    # logging.info(f"Downloading blob: {container_name}/{blob_name}")

    stream: StorageStreamDownloader = blob_client.download_blob()
    data = stream.readall()   

    return data




from .models import MetaDataBlob
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
def get_user_blobs_page(request, per_page=4):
    blobs = MetaDataBlob.objects.filter(owner=request.user).order_by('id')
    # page_number = request.GET.get('page')
    paginator=Paginator(blobs,per_page=per_page)

    page_number = request.GET.get('page',1)
    try:
        page_obj = paginator.get_page(page_number)
    except PageNotAnInteger:
        page_obj = paginator.page(1)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages)

    return page_obj